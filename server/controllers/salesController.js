const mongoose = require("mongoose");
const Sale = require("../models/CustomerSale");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const ProductVariation = require("../models/ProductVariation");
const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const SaleReturn = require("../models/SaleReturn");
const SaleLedger = require("../models/SaleLedger");
const Customer = require("../models/Customer");
const { applyStockTransaction } = require("../utils/stock.service");
const { createSaleLedgerEntry } = require("../utils/saleLedger.service");
const {
  getCustomerDuplicateMessage,
  normalizeCustomerPhone,
  syncCustomerAccountSnapshot,
} = require("../utils/customerAccount.service");
const { generateInvoiceNo } = require("../utils/invoice.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;
const ALLOWED_REFUND_METHODS = new Set(["CASH", "BANK", "ONLINE", "UPI", "CARD", "STORE_CREDIT"]);
const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"]);
const ALLOWED_SALE_PAYMENT_METHODS = new Set(["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT"]);
const canViewSensitiveFinancials = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const getSaleNetPayableAmount = (sale = {}) =>
  Math.max(
    0,
    roundAmount(Number(sale?.totalAmount || 0) - Number(sale?.returnedAmount || 0)),
  );

const getSaleCollectibleDue = (sale = {}) =>
  Math.max(
    0,
    roundAmount(
      getSaleNetPayableAmount(sale) -
        Number(sale?.paidAmount || 0) -
        Number(sale?.walletUsedAmount || 0),
    ),
  );

const saleCollectibleDueExpr = () => ({
  $max: [
    0,
    {
      $subtract: [
        {
          $subtract: [
            {
              $subtract: [
                { $ifNull: ["$totalAmount", 0] },
                { $ifNull: ["$returnedAmount", 0] },
              ],
            },
            { $ifNull: ["$paidAmount", 0] },
          ],
        },
        { $ifNull: ["$walletUsedAmount", 0] },
      ],
    },
  ],
});

const getNetSaleItemQuantity = (item = {}) =>
  Math.max(0, Number(item?.quantity || 0) - Number(item?.returnedQuantity || 0));

const normalizeSalePaymentMethod = (value = "CASH") => {
  const normalized = `${value || "CASH"}`.trim().toUpperCase();
  return ALLOWED_SALE_PAYMENT_METHODS.has(normalized) ? normalized : null;
};

const normalizeSplitPayments = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      method: normalizeSalePaymentMethod(row?.method),
      amount: roundAmount(Math.max(0, Number(row?.amount || 0))),
    }))
    .filter((row) => row.method && row.amount > 0);

const sumSaleReturnedByVariation = async ({ shopId, saleId }) => {
  const rows = await SaleReturn.aggregate([
    { $match: { shop: shopId, sale: saleId, status: "APPROVED" } },
    { $unwind: "$items" },
    { $group: { _id: "$items.variationId", qty: { $sum: "$items.quantity" } } },
  ]);

  const result = new Map();
  rows.forEach((r) => {
    result.set(`${r._id}`, Number(r.qty || 0));
  });
  return result;
};

const getSaleReturnTotals = async ({ shopId, saleId }) => {
  const rows = await SaleReturn.aggregate([
    { $match: { shop: shopId, sale: saleId, status: "APPROVED" } },
    {
      $group: {
        _id: null,
        qty: { $sum: "$totalQuantity" },
        amount: { $sum: "$totalAmount" },
        refund: { $sum: "$refundAmount" },
        dueAdjusted: { $sum: "$dueAdjustedAmount" },
        credit: { $sum: "$creditAmount" },
      },
    },
  ]);

  return {
    qty: Number(rows[0]?.qty || 0),
    amount: Number(rows[0]?.amount || 0),
    refund: Number(rows[0]?.refund || 0),
    dueAdjusted: Number(rows[0]?.dueAdjusted || 0),
    credit: Number(rows[0]?.credit || 0),
  };
};

const buildVariationSnapshot = (variation, rawItem = {}, userRole = "STAFF") => {
  const qty = Math.max(0, Number(rawItem?.quantity || 0));
  
  // PRICE VALIDATION: Prevent unauthorized price overrides
  // Only SUPER_ADMIN and ADMIN can set custom prices
  const catalogPrice = Number(variation?.sellingPrice ?? 0);
  const requestedPrice = Number(rawItem?.sellingPrice ?? rawItem?.price ?? catalogPrice);
  
  // Maximum discount allowed for non-privileged roles (10% by default)
  const MAX_DISCOUNT_PERCENT = 10;
  const minAllowedPrice = catalogPrice * (1 - MAX_DISCOUNT_PERCENT / 100);
  
  // STAFF and MANAGER cannot override price below catalog with >10% discount
  const isPrivilegedRole = ["SUPER_ADMIN", "ADMIN"].includes(userRole);
  const sellingPrice = isPrivilegedRole
    ? requestedPrice  // Privileged roles can set any price
    : Math.max(requestedPrice, minAllowedPrice);  // Enforce minimum price
  
  const costPrice = Number(variation?.costPrice || 0);
  const lineTotal = Number((qty * sellingPrice).toFixed(2));
  const categoryName =
    variation?.product?.category?.name ||
    rawItem?.categoryName ||
    rawItem?.category?.name ||
    "";
  const brandName =
    variation?.product?.brand?.name ||
    rawItem?.brandName ||
    rawItem?.brand?.name ||
    "";

  return {
    item: variation.product?._id || variation.product,
    variationId: variation._id,
    variationSku: variation.sku,
    itemName: variation.product?.name || rawItem?.itemName || "Item",
    model: variation.model?.name || rawItem?.model || "",
    size: variation.attributes?.size || rawItem?.size || "",
    color: variation.attributes?.color || rawItem?.color || "",
    categoryName,
    brandName,
    quantity: qty,
    purchasePrice: costPrice,
    sellingPrice,
    catalogPrice,
    priceOverride: sellingPrice !== catalogPrice ? {
      requested: requestedPrice,
      applied: sellingPrice,
      reason: isPrivilegedRole ? "privileged_role" : "max_discount_enforced",
    } : null,
    discount: 0,
    discountType: "FLAT",
    total: lineTotal,
    _variationRef: variation,
  };
};

const getSellableStock = (stock = {}) =>
  Math.max(
    0,
    Number(stock?.quantity || 0) - Number(stock?.reservedQuantity || 0) - Number(stock?.damagedQuantity || 0),
  );

const resolveVariation = async (shopId, rawItem = {}) => {
  const variationId = `${rawItem?.variationId || ""}`.trim();
  const variationSku = `${rawItem?.variationSku || rawItem?.variations || ""}`.trim();

  if (variationId && mongoose.Types.ObjectId.isValid(variationId)) {
    const byId = await ProductVariation.findOne({ _id: variationId, shop: shopId })
      .populate({
        path: "product",
        select: "name brand category",
        populate: [
          { path: "brand", select: "name" },
          { path: "category", select: "name" },
        ],
      })
      .populate("model", "name");
    if (byId) return byId;
  }

  if (variationSku) {
    const bySku = await ProductVariation.findOne({ shop: shopId, sku: variationSku })
      .populate({
        path: "product",
        select: "name brand category",
        populate: [
          { path: "brand", select: "name" },
          { path: "category", select: "name" },
        ],
      })
      .populate("model", "name");
    if (bySku) return bySku;
  }

  const itemName = `${rawItem?.itemName || ""}`.trim();
  const modelName = `${rawItem?.model || ""}`.trim();
  const size = `${rawItem?.size || ""}`.trim();

  if (!itemName) return null;

  const products = await Product.find({
    shop: shopId,
    name: { $regex: new RegExp(`^${itemName}$`, "i") },
  }).select("_id name brand category");
  if (!products.length) return null;

  let modelIds = [];
  if (modelName) {
    const models = await ProductModel.find({
      shop: shopId,
      product: { $in: products.map((p) => p._id) },
      name: { $regex: new RegExp(`^${modelName}$`, "i") },
    }).select("_id");
    modelIds = models.map((m) => m._id);
    if (!modelIds.length) return null;
  }

  const variationQuery = {
    shop: shopId,
    product: { $in: products.map((p) => p._id) },
  };
  if (modelIds.length) variationQuery.model = { $in: modelIds };
  if (size) variationQuery["attributes.size"] = { $regex: new RegExp(`^${size}$`, "i") };

  return ProductVariation.findOne(variationQuery)
    .populate({
      path: "product",
      select: "name brand category",
      populate: [
        { path: "brand", select: "name" },
        { path: "category", select: "name" },
      ],
    })
    .populate("model", "name");
};

exports.createSale = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const {
      customer,
      customerName = "Walk-in",
      customerPhone = "",
      customerAddress = "",
      items = [],
      paymentMethod = "CASH",
      billDiscount = 0,
      paidAmount = 0,
      walletUsedAmount = 0,
      splitPayments = null,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "items[] is required" });
    }

    // Find or create customer
    let customerDoc = null;
    const normalizedCustomerName = `${customerName || ""}`.trim();
    const normalizedPhone = normalizeCustomerPhone(customerPhone);
    
    if (customer && mongoose.Types.ObjectId.isValid(`${customer}`)) {
      customerDoc = await Customer.findOne({
        _id: customer,
        shop: req.shopId,
        isDeleted: { $ne: true },
      });
      if (!customerDoc) {
        return res.status(404).json({
          success: false,
          message: "Selected customer not found for this shop",
        });
      }
    } else if (normalizedCustomerName && normalizedCustomerName !== "Walk-in" && normalizedPhone && normalizedPhone.length === 10) {
      customerDoc = await Customer.findOne({ 
        shop: req.shopId, 
        phone: normalizedPhone,
      });

      if (!customerDoc) {
        customerDoc = await Customer.findOne({ 
          shop: req.shopId, 
          name: { $regex: new RegExp(`^${normalizedCustomerName}$`, 'i') }
        });
      }

      if (!customerDoc) {
        const normalizedAddress = `${customerAddress || ""}`.trim();
        try {
          customerDoc = await Customer.create({
            shop: req.shopId,
            name: normalizedCustomerName,
            phone: normalizedPhone,
            address: normalizedAddress || "",
            createdBy: req.user?._id
          });
        } catch (err) {
          if (err.code === 11000) {
            customerDoc = await Customer.findOne({ 
              shop: req.shopId, 
              phone: normalizedPhone,
            });
          } else {
            const duplicateMessage = getCustomerDuplicateMessage(err);
            if (duplicateMessage) {
              return res.status(err.statusCode || 409).json({
                success: false,
                message: duplicateMessage,
              });
            }
          }
        }
      }
    } else if (normalizedCustomerName && normalizedCustomerName !== "Walk-in") {
      customerDoc = await Customer.findOne({ 
        shop: req.shopId, 
        name: { $regex: new RegExp(`^${normalizedCustomerName}$`, 'i') }
      });
    }

    const normalizedItems = [];
    const fastLookupItems = items.filter((raw) => raw?.variationId || raw?.variationSku || raw?.variations);
    const variationIds = fastLookupItems
      .map((raw) => `${raw?.variationId || ""}`.trim())
      .filter((value) => value && mongoose.Types.ObjectId.isValid(value));
    const variationSkus = fastLookupItems
      .map((raw) => `${raw?.variationSku || raw?.variations || ""}`.trim())
      .filter(Boolean);

    const [variationRows, stockRows] = await Promise.all([
      variationIds.length || variationSkus.length
        ? ProductVariation.find({
            shop: req.shopId,
            $or: [
              ...(variationIds.length ? [{ _id: { $in: variationIds } }] : []),
              ...(variationSkus.length ? [{ sku: { $in: variationSkus } }] : []),
            ],
          })
            .populate({
              path: "product",
              select: "name brand category",
              populate: [
                { path: "brand", select: "name" },
                { path: "category", select: "name" },
              ],
            })
            .populate("model", "name")
        : [],
      variationIds.length
        ? Stock.find({ shop: req.shopId, variation: { $in: variationIds } }).lean()
        : [],
    ]);
    const variationById = new Map(variationRows.map((row) => [`${row._id}`, row]));
    const variationBySku = new Map(variationRows.map((row) => [`${row.sku}`, row]));
    const stockByVariation = new Map(stockRows.map((row) => [`${row.variation}`, row]));

    for (const raw of items) {
      const qty = Math.max(0, Number(raw?.quantity || 0));
      if (qty <= 0) {
        return res.status(400).json({ success: false, message: "Item quantity must be greater than 0" });
      }

      const requestedVariationId = `${raw?.variationId || ""}`.trim();
      const requestedVariationSku = `${raw?.variationSku || raw?.variations || ""}`.trim();
      let variation =
        (requestedVariationId && variationById.get(requestedVariationId)) ||
        (requestedVariationSku && variationBySku.get(requestedVariationSku)) ||
        null;
      if (!variation) {
        variation = await resolveVariation(req.shopId, raw);
      }
      if (!variation) {
        return res.status(400).json({
          success: false,
          message: `Variation not found for item ${raw?.itemName || raw?.variationSku || "unknown"}`,
        });
      }

      const stock =
        stockByVariation.get(`${variation._id}`) ||
        (await Stock.findOne({ shop: req.shopId, variation: variation._id }).lean());
      const available = getSellableStock(stock);
      if (available < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for SKU ${variation.sku}. Available: ${available}, Requested: ${qty}`,
        });
      }

      // Pass user role to enforce price validation
      normalizedItems.push(buildVariationSnapshot(variation, raw, req.user?.role || "STAFF"));
    }

    const totalQuantity = normalizedItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const subTotal = normalizedItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
    const safeBillDiscount = Math.max(0, Number(billDiscount || 0));
    const totalAmount = Math.max(0, Number((subTotal - safeBillDiscount).toFixed(2)));
    const normalizedPaymentMethod = normalizeSalePaymentMethod(paymentMethod);
    if (!normalizedPaymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const normalizedSplitPayments = normalizeSplitPayments(splitPayments);
    const hasSplitPayments = normalizedSplitPayments.length > 0;
    const computedSplitPaidAmount = roundAmount(
      normalizedSplitPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    );
    const safePaidAmount = hasSplitPayments
      ? computedSplitPaidAmount
      : Math.max(0, roundAmount(Number(paidAmount || 0)));
    const safeWalletUsedAmount = Math.max(0, Number(walletUsedAmount || 0));
    if (safePaidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be greater than net bill amount",
      });
    }
    if (safeWalletUsedAmount > 0 && !customerDoc?._id) {
      return res.status(400).json({
        success: false,
        message: "Wallet can only be used for a saved customer",
      });
    }
    if (safeWalletUsedAmount > Number(customerDoc?.walletBalance || 0)) {
      return res.status(400).json({
        success: false,
        message: `Wallet amount cannot exceed available balance ${Number(customerDoc?.walletBalance || 0).toFixed(2)}`,
      });
    }
    if (safePaidAmount + safeWalletUsedAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Paid amount plus wallet amount cannot be greater than net bill amount",
      });
    }
    if (
      hasSplitPayments &&
      Math.abs(roundAmount(safePaidAmount + safeWalletUsedAmount) - roundAmount(totalAmount)) > 0.01
    ) {
      return res.status(400).json({
        success: false,
        message: "Split payment plus wallet must settle the full bill amount",
      });
    }

    const resolvedPaymentMethod = hasSplitPayments
      ? (new Set(normalizedSplitPayments.map((row) => row.method)).size === 1
          ? normalizedSplitPayments[0].method
          : "SPLIT")
      : normalizedPaymentMethod;

    // MONGODB TRANSACTION: Ensure atomicity of Sale + Ledger + Stock operations
    // If any step fails, entire transaction is rolled back - no orphaned records
    const mongooseSession = await mongoose.startSession();
    mongooseSession.startTransaction();

    try {
      const saleDocItems = normalizedItems.map((it) => {
        const output = { ...it };
        delete output._variationRef;
        return output;
      });

      const invoiceNo = await generateInvoiceNo({ type: "SALE" });
      const sale = await Sale.create([{
        shop: req.shopId,
        customer: customerDoc?._id || req.body?.customer || undefined,
        customerName,
        invoiceNo,
        items: saleDocItems,
        totalQuantity,
        subTotal,
        billDiscount: safeBillDiscount,
        totalAmount,
        paymentMethod: resolvedPaymentMethod,
        paymentBreakdown: hasSplitPayments ? normalizedSplitPayments : [],
        paidAmount: safePaidAmount,
        walletUsedAmount: safeWalletUsedAmount,
        dueAmount: getSaleCollectibleDue({
          totalAmount,
          paidAmount: safePaidAmount,
          walletUsedAmount: safeWalletUsedAmount,
          returnedAmount: 0,
        }),
        orderSource: "POS",
        status: "COMPLETED",
      }], { session: mongooseSession });

      const saleDoc = sale[0];

      await createSaleLedgerEntry({
        shop: req.shopId,
        sale: saleDoc._id,
        customer: saleDoc.customer,
        customerName: saleDoc.customerName,
        type: "sale",
        amount: Number(saleDoc.totalAmount || 0),
        referenceId: saleDoc._id,
        note: `Sale ${saleDoc.invoiceNo || saleDoc._id}`,
        createdBy: req.user?._id,
        session: mongooseSession,
      });

      if (safePaidAmount > 0) {
        const paymentRows = hasSplitPayments
          ? normalizedSplitPayments
          : [{ method: normalizedPaymentMethod, amount: safePaidAmount }];

        for (const paymentRow of paymentRows) {
          await createSaleLedgerEntry({
            shop: req.shopId,
            sale: saleDoc._id,
            customer: saleDoc.customer,
            customerName: saleDoc.customerName,
            type: "payment",
            amount: Number(paymentRow.amount || 0),
            paymentMethod: paymentRow.method,
            referenceId: saleDoc._id,
            note: `Sale payment (${paymentRow.method}) ${saleDoc.invoiceNo || saleDoc._id}`,
            createdBy: req.user?._id,
            session: mongooseSession,
          });
        }
      }

      if (safeWalletUsedAmount > 0) {
        await createSaleLedgerEntry({
          shop: req.shopId,
          sale: saleDoc._id,
          customer: saleDoc.customer,
          customerName: saleDoc.customerName,
          type: "wallet_use",
          amount: safeWalletUsedAmount,
          paymentMethod: "STORE_CREDIT",
          referenceId: saleDoc._id,
          note: `Wallet used ${saleDoc.invoiceNo || saleDoc._id}`,
          createdBy: req.user?._id,
          session: mongooseSession,
        });
      }

      // Update customer wallet balance atomically within transaction
      if (safeWalletUsedAmount > 0 && saleDoc.customer) {
        await Customer.findByIdAndUpdate(
          saleDoc.customer,
          { $inc: { walletBalance: -safeWalletUsedAmount } },
          { session: mongooseSession }
        );
      }

      // Stock deductions - all atomic within transaction
      await Promise.all(
        normalizedItems.map((it) => {
          const variation = it._variationRef;
          return applyStockTransaction({
            shop: req.shopId,
            product: variation.product?._id || variation.product,
            model: variation.model?._id || variation.model,
            variation: variation._id,
            sku: variation.sku,
            type: "OUT",
            quantity: Number(it.quantity || 0),
            referenceType: "SALE",
            referenceId: saleDoc._id,
            note: `POS sale ${saleDoc.invoiceNo || saleDoc._id}`,
            createdBy: req.user?._id,
            session: mongooseSession,
          });
        }),
      );

      // Commit transaction - all operations succeeded
      await mongooseSession.commitTransaction();
      mongooseSession.endSession();

      // Sync customer snapshot AFTER transaction (non-blocking, can fail without affecting sale)
      if (saleDoc.customer) {
        syncCustomerAccountSnapshot({
          shopId: req.shopId,
          customerId: saleDoc.customer,
        }).catch((err) => {
          console.error("Customer snapshot sync failed (non-critical):", err.message);
        });
      }

      return res.status(201).json({
        success: true,
        message: "Sale created successfully",
        sale: saleDoc,
      });
    } catch (transactionError) {
      // Rollback transaction - all changes undone
      await mongooseSession.abortTransaction();
      mongooseSession.endSession();
      throw transactionError;
    }
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.invoiceNo) {
      return res.status(409).json({
        success: false,
        message: "Invoice number conflict, please retry sale",
      });
    }
    console.error("Error creating sale:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error creating sale. Please try again.",
    });
  }
};

exports.getSales = async (req, res) => {
  try {
    const {
      page = 1,
      perPage = 10,
      invoiceNo,
      itemName,
      customerName,
      startDate,
      endDate,
      returnStatus,
      paymentMethod,
      dueOnly,
    } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(perPage || 10)));
    const skip = (safePage - 1) * safeLimit;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (customerName && customerName !== "null") {
      query.customerName = { $regex: customerName, $options: "i" };
    }
    if (invoiceNo && invoiceNo !== "null") {
      query.invoiceNo = { $regex: invoiceNo, $options: "i" };
    }

    if (itemName && itemName !== "null") {
      query["items.itemName"] = { $regex: itemName, $options: "i" };
    }
    if (paymentMethod && paymentMethod !== "null") {
      const normalizedFilterPaymentMethod = `${paymentMethod}`.trim().toUpperCase();
      query.$or = [
        { paymentMethod: normalizedFilterPaymentMethod },
        { "paymentBreakdown.method": normalizedFilterPaymentMethod },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate && startDate !== "null") query.createdAt.$gte = new Date(startDate);
      if (endDate && endDate !== "null") {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const exprConditions = [];
    const normalizedReturnStatus = `${returnStatus || ""}`.trim().toUpperCase();
    if (normalizedReturnStatus === "NONE") {
      query.returnedQuantity = { $lte: 0 };
    } else if (normalizedReturnStatus === "FULL") {
      exprConditions.push({ $gt: ["$totalQuantity", 0] });
      exprConditions.push({ $gte: ["$returnedQuantity", "$totalQuantity"] });
    } else if (normalizedReturnStatus === "PARTIAL") {
      exprConditions.push({ $gt: ["$returnedQuantity", 0] });
      exprConditions.push({ $lt: ["$returnedQuantity", "$totalQuantity"] });
    }

    const dueOnlyFlag = `${dueOnly || ""}`.trim().toLowerCase();
    if (dueOnlyFlag === "true" || dueOnlyFlag === "1" || dueOnlyFlag === "yes") {
      exprConditions.push({ $gt: [saleCollectibleDueExpr(), 0] });
    }

    if (exprConditions.length === 1) {
      query.$expr = exprConditions[0];
    } else if (exprConditions.length > 1) {
      query.$expr = { $and: exprConditions };
    }

    const [rows, totalItems] = await Promise.all([
      Sale.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Sale.countDocuments(query),
    ]);

    const allowFinancials = canViewSensitiveFinancials(req);
    const itemResults = rows.map((s) => {
      const totalCostAmount = Number(
        (s.items || []).reduce(
          (acc, it) => acc + getNetSaleItemQuantity(it) * Number(it?.purchasePrice || 0),
          0,
        ),
      );
      const totalSaleAmount = Number(
        (Number(s.totalAmount || 0) - Number(s.returnedAmount || 0)).toFixed(2),
      );
      const grossProfit = Number((totalSaleAmount - totalCostAmount).toFixed(2));
      const grossMarginPercent = totalSaleAmount > 0
        ? Number(((grossProfit / totalSaleAmount) * 100).toFixed(2))
        : 0;

      return {
        _id: s._id,
        invoiceNo: s.invoiceNo || null,
        customerName: s.customerName || "Walk-in",
        totalPurchasePrice: Number(s.totalAmount || 0),
        totalSaleAmount,
        ...(allowFinancials
          ? {
              totalCostAmount,
              grossProfit,
              grossMarginPercent,
            }
          : {}),
        billDiscount: Number(s.billDiscount || 0),
        paidAmount: Number(s.paidAmount || 0),
        walletUsedAmount: Number(s.walletUsedAmount || 0),
        dueAmount: getSaleCollectibleDue(s),
        paymentBreakdown: Array.isArray(s.paymentBreakdown)
          ? s.paymentBreakdown.map((row) => ({
              method: row?.method || "CASH",
              amount: Number(row?.amount || 0),
            }))
          : [],
        totalQuantity: Number(s.totalQuantity || 0),
        returnedQuantity: Number(s.returnedQuantity || 0),
        returnedAmount: Number(s.returnedAmount || 0),
        refundedAmount: Number(s.refundedAmount || 0),
        dueAdjustedAmount: Number(s.dueAdjustedAmount || 0),
        creditedAmount: Number(s.creditedAmount || 0),
        purchaseDate: s.createdAt,
        paymentMethod: s.paymentMethod,
        status: s.status,
        items: (s.items || []).map((it) => ({
          item: it.item,
          variationId: it.variationId,
          variationSku: it.variationSku,
          itemName: it.itemName || "-",
          brand: { name: it.brandName || "-" },
          category: { name: it.categoryName || "-" },
          model: it.model || "-",
          size: it.size || "-",
          quantity: Number(it.quantity || 0),
          returnedQuantity: Number(it.returnedQuantity || 0),
          sellingPrice: Number(it.sellingPrice || 0),
          lineSale: Number((Number(it.quantity || 0) * Number(it.sellingPrice || 0)).toFixed(2)),
          ...(allowFinancials
            ? {
              costPrice: Number(it.purchasePrice || 0),
              lineCost: Number((Number(it.quantity || 0) * Number(it.purchasePrice || 0)).toFixed(2)),
              }
            : {}),
        })),
      };
    });

    return res.status(200).json({
      success: true,
      itemResults,
      totalItems,
      page: safePage,
      perPage: safeLimit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching sales",
      error: "Internal server error",
    });
  }
};

exports.getCustomerSuggestions = async (req, res) => {
  try {
    const term = `${req.query?.term || ""}`.trim();
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (term) {
      query.customerName = { $regex: term, $options: "i" };
    }

    const rows = await Sale.find(query).select("customerName").limit(200).lean();
    const set = new Set();
    rows.forEach((r) => {
      const name = `${r?.customerName || ""}`.trim();
      if (!name) return;
      set.add(name);
    });

    return res.status(200).json(Array.from(set).slice(0, 20));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching customer suggestions",
      error: "Internal server error",
    });
  }
};

exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const hasObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isSuperAdminGlobal(req)
      ? hasObjectId
        ? { $or: [{ _id: id }, { invoiceNo: id }] }
        : { invoiceNo: id }
      : hasObjectId
        ? { shop: req.shopId, $or: [{ _id: id }, { invoiceNo: id }] }
        : { shop: req.shopId, invoiceNo: id };
    const sale = await Sale.findOne(query);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const responseSale = sale.toObject();
    responseSale.dueAmount = getSaleCollectibleDue(responseSale);
    return res.status(200).json({ success: true, data: responseSale });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching sale",
      error: "Internal server error",
    });
  }
};

exports.getSaleLedger = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const query = isSuperAdminGlobal(req)
      ? { sale: id }
      : { shop: req.shopId, sale: id };

    const rows = await SaleLedger.find(query).sort({ createdAt: 1 });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching sale ledger",
      error: "Internal server error",
    });
  }
};

exports.collectSalePayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const sale = await Sale.findOne({ _id: id, shop: req.shopId });
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found for selected shop" });
    }

    const currentDue = getSaleCollectibleDue(sale);
    if (currentDue <= 0) {
      return res.status(409).json({ success: false, message: "No outstanding due for this sale" });
    }

    const amount = Math.max(0, Number(req.body?.amount || 0));
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }
    if (amount > currentDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed due ${currentDue.toFixed(2)}`,
      });
    }

    const paymentMethod = `${req.body?.paymentMethod || "CASH"}`.trim().toUpperCase();
    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }

    // IDEMPOTENCY CHECK: Prevent duplicate payments with same amount & method
    // Check if a similar payment was already made recently (within last 5 minutes)
    const idempotencyWindow = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    const recentPayment = await SaleLedger.findOne({
      shop: req.shopId,
      sale: sale._id,
      type: "payment",
      amount,
      paymentMethod,
      createdAt: { $gte: idempotencyWindow },
    });

    if (recentPayment) {
      return res.status(409).json({
        success: false,
        message: `Duplicate payment detected. A payment of ${amount.toFixed(2)} via ${paymentMethod} was already recorded recently.`,
        existingPayment: {
          id: recentPayment._id,
          timestamp: recentPayment.createdAt,
          note: recentPayment.note,
        },
      });
    }

    sale.paidAmount = roundAmount(Number(sale.paidAmount || 0) + amount);
    sale.dueAmount = getSaleCollectibleDue(sale);
    await sale.save();

    await createSaleLedgerEntry({
      shop: req.shopId,
      sale: sale._id,
      customer: sale.customer,
      customerName: sale.customerName,
      type: "payment",
      amount,
      paymentMethod,
      referenceId: sale._id,
      note:
        `${req.body?.note || ""}`.trim() ||
        `Additional payment (${paymentMethod}) ${sale.invoiceNo || sale._id}`,
      createdBy: req.user?._id,
    });

    if (sale.customer) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: sale.customer,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment collected successfully",
      data: sale,
    });
  } catch (error) {
    console.error("Error collecting sale payment:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error collecting payment. Please try again.",
    });
  }
};

exports.listSaleReturns = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const query = isSuperAdminGlobal(req)
      ? { sale: id }
      : { shop: req.shopId, sale: id };

    const rows = await SaleReturn.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "email role");

    const totalReturnedQty = rows.reduce((acc, r) => acc + Number(r.totalQuantity || 0), 0);
    const totalReturnedAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0).toFixed(2),
    );
    const totalRefundedAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.refundAmount || 0), 0).toFixed(2),
    );
    const totalCreditAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.creditAmount || 0), 0).toFixed(2),
    );
    const totalDueAdjustedAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.dueAdjustedAmount || 0), 0).toFixed(2),
    );

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        count: rows.length,
        totalReturnedQty,
        totalReturnedAmount,
        totalRefundedAmount,
        totalCreditAmount,
        totalDueAdjustedAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching sale returns",
      error: "Internal server error",
    });
  }
};

exports.listAllSaleReturns = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", dateFrom, dateTo, refundMethod } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (search) {
      const saleRows = await Sale.find({
        ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
        invoiceNo: { $regex: search, $options: "i" },
      })
        .select("_id")
        .limit(200)
        .lean();
      const saleIds = saleRows.map((s) => s._id);

      query.$or = [{ customerName: { $regex: search, $options: "i" } }, { note: { $regex: search, $options: "i" } }];
      if (saleIds.length) {
        query.$or.push({ sale: { $in: saleIds } });
      }
    }
    if (refundMethod && refundMethod !== "null") {
      query.refundMethod = `${refundMethod}`.trim().toUpperCase();
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!Number.isNaN(from.getTime())) query.createdAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          query.createdAt.$lte = to;
        }
      }
    }

    const [rows, totalItems] = await Promise.all([
      SaleReturn.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("sale", "_id invoiceNo")
        .populate("createdBy", "email role"),
      SaleReturn.countDocuments(query),
    ]);

    const totalReturnedQty = rows.reduce((acc, r) => acc + Number(r.totalQuantity || 0), 0);
    const totalReturnedAmount = Number(rows.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0).toFixed(2));
    const totalRefundedAmount = Number(rows.reduce((acc, r) => acc + Number(r.refundAmount || 0), 0).toFixed(2));
    const totalCreditAmount = Number(rows.reduce((acc, r) => acc + Number(r.creditAmount || 0), 0).toFixed(2));
    const totalDueAdjustedAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.dueAdjustedAmount || 0), 0).toFixed(2),
    );

    return res.status(200).json({
      success: true,
      data: rows,
      totalItems,
      page: safePage,
      limit: safeLimit,
      summary: {
        totalReturnedQty,
        totalReturnedAmount,
        totalRefundedAmount,
        totalCreditAmount,
        totalDueAdjustedAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching all sale returns",
      error: "Internal server error",
    });
  }
};

exports.getSalesReportOverview = async (req, res) => {
  try {
    const { dateFrom, dateTo, paymentMethod, returnStatus } = req.query;
    const saleQuery = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const returnQuery = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (paymentMethod && paymentMethod !== "null") {
      const normalizedFilterPaymentMethod = `${paymentMethod}`.trim().toUpperCase();
      saleQuery.$or = [
        { paymentMethod: normalizedFilterPaymentMethod },
        { "paymentBreakdown.method": normalizedFilterPaymentMethod },
      ];
    }

    if (dateFrom || dateTo) {
      saleQuery.createdAt = {};
      returnQuery.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (!Number.isNaN(from.getTime())) {
          saleQuery.createdAt.$gte = from;
          returnQuery.createdAt.$gte = from;
        }
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          saleQuery.createdAt.$lte = to;
          returnQuery.createdAt.$lte = to;
        }
      }
    }

    const exprConditions = [];
    const normalizedReturnStatus = `${returnStatus || ""}`.trim().toUpperCase();
    if (normalizedReturnStatus === "NONE") {
      saleQuery.returnedQuantity = { $lte: 0 };
    } else if (normalizedReturnStatus === "FULL") {
      exprConditions.push({ $gt: ["$totalQuantity", 0] });
      exprConditions.push({ $gte: ["$returnedQuantity", "$totalQuantity"] });
    } else if (normalizedReturnStatus === "PARTIAL") {
      exprConditions.push({ $gt: ["$returnedQuantity", 0] });
      exprConditions.push({ $lt: ["$returnedQuantity", "$totalQuantity"] });
    }
    if (exprConditions.length === 1) saleQuery.$expr = exprConditions[0];
    if (exprConditions.length > 1) saleQuery.$expr = { $and: exprConditions };

    const trendStart = dateFrom ? new Date(dateFrom) : new Date();
    if (!dateFrom) {
      trendStart.setHours(0, 0, 0, 0);
      trendStart.setDate(trendStart.getDate() - 6);
    }

    const [salesAgg, returnAgg, itemProfitAgg, customerProfitAgg, categoryProfitAgg, dailyProfitAgg] = await Promise.all([
      Sale.aggregate([
        { $match: saleQuery },
        {
          $addFields: {
            totalReturnedCostAmount: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "item",
                  in: {
                    $multiply: [
                      {
                        $max: [
                          {
                            $subtract: [
                              { $toDouble: { $ifNull: ["$$item.quantity", 0] } },
                              { $toDouble: { $ifNull: ["$$item.returnedQuantity", 0] } },
                            ],
                          },
                          0,
                        ],
                      },
                      { $toDouble: { $ifNull: ["$$item.purchasePrice", 0] } },
                    ],
                  },
                },
              },
            },
            totalCostAmount: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "item",
                  in: {
                    $multiply: [
                      { $toDouble: { $ifNull: ["$$item.quantity", 0] } },
                      { $toDouble: { $ifNull: ["$$item.purchasePrice", 0] } },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: {
              $sum: {
                $subtract: [
                  { $ifNull: ["$totalAmount", 0] },
                  { $ifNull: ["$returnedAmount", 0] },
                ],
              },
            },
            totalCostAmount: { $sum: "$totalReturnedCostAmount" },
            totalPaid: { $sum: "$paidAmount" },
            totalDue: { $sum: saleCollectibleDueExpr() },
            totalReturnedQty: { $sum: "$returnedQuantity" },
            totalReturnedAmount: { $sum: "$returnedAmount" },
            totalRefundedAmount: { $sum: "$refundedAmount" },
          },
        },
      ]),
      SaleReturn.aggregate([
        { $match: returnQuery },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
            totalRefund: { $sum: "$refundAmount" },
            totalCredit: { $sum: "$creditAmount" },
            totalDueAdjusted: { $sum: "$dueAdjustedAmount" },
            totalQty: { $sum: "$totalQuantity" },
          },
        },
      ]),
      canViewSensitiveFinancials(req)
        ? Sale.aggregate([
            { $match: saleQuery },
            { $unwind: "$items" },
            {
              $group: {
                _id: {
                  itemName: "$items.itemName",
                  model: "$items.model",
                },
                soldQty: {
                  $sum: {
                    $max: [
                      {
                        $subtract: [
                          { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                          { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                        ],
                      },
                      0,
                    ],
                  },
                },
                saleAmount: {
                  $sum: {
                    $multiply: [
                      {
                        $max: [
                          {
                            $subtract: [
                              { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                              { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                            ],
                          },
                          0,
                        ],
                      },
                      { $toDouble: { $ifNull: ["$items.sellingPrice", 0] } },
                    ],
                  },
                },
                costAmount: {
                  $sum: {
                    $multiply: [
                      {
                        $max: [
                          {
                            $subtract: [
                              { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                              { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                            ],
                          },
                          0,
                        ],
                      },
                      { $toDouble: { $ifNull: ["$items.purchasePrice", 0] } },
                    ],
                  },
                },
              },
            },
            {
              $addFields: {
                grossProfit: { $subtract: ["$saleAmount", "$costAmount"] },
              },
            },
            { $sort: { grossProfit: -1, soldQty: -1 } },
            { $limit: 10 },
          ])
        : Promise.resolve([]),
      canViewSensitiveFinancials(req)
        ? Sale.aggregate([
            { $match: saleQuery },
            {
              $addFields: {
                totalNetAmount: {
                  $subtract: [
                    { $ifNull: ["$totalAmount", 0] },
                    { $ifNull: ["$returnedAmount", 0] },
                  ],
                },
                totalCostAmount: {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "item",
                      in: {
                        $multiply: [
                          {
                            $max: [
                              {
                                $subtract: [
                                  { $toDouble: { $ifNull: ["$$item.quantity", 0] } },
                                  { $toDouble: { $ifNull: ["$$item.returnedQuantity", 0] } },
                                ],
                              },
                              0,
                            ],
                          },
                          { $toDouble: { $ifNull: ["$$item.purchasePrice", 0] } },
                        ],
                      },
                    },
                  },
                },
              },
            },
            {
              $group: {
                _id: { customerName: "$customerName" },
                billCount: { $sum: 1 },
                saleAmount: { $sum: "$totalNetAmount" },
                costAmount: { $sum: "$totalCostAmount" },
              },
            },
            {
              $addFields: {
                grossProfit: { $subtract: ["$saleAmount", "$costAmount"] },
              },
            },
            { $sort: { grossProfit: -1, saleAmount: -1 } },
            { $limit: 10 },
          ])
        : Promise.resolve([]),
      canViewSensitiveFinancials(req)
        ? Sale.aggregate([
            { $match: saleQuery },
            { $unwind: "$items" },
            {
              $group: {
                _id: { categoryName: "$items.categoryName" },
                soldQty: {
                  $sum: {
                    $max: [
                      {
                        $subtract: [
                          { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                          { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                        ],
                      },
                      0,
                    ],
                  },
                },
                saleAmount: {
                  $sum: {
                    $multiply: [
                      {
                        $max: [
                          {
                            $subtract: [
                              { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                              { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                            ],
                          },
                          0,
                        ],
                      },
                      { $toDouble: { $ifNull: ["$items.sellingPrice", 0] } },
                    ],
                  },
                },
                costAmount: {
                  $sum: {
                    $multiply: [
                      {
                        $max: [
                          {
                            $subtract: [
                              { $toDouble: { $ifNull: ["$items.quantity", 0] } },
                              { $toDouble: { $ifNull: ["$items.returnedQuantity", 0] } },
                            ],
                          },
                          0,
                        ],
                      },
                      { $toDouble: { $ifNull: ["$items.purchasePrice", 0] } },
                    ],
                  },
                },
              },
            },
            {
              $addFields: {
                grossProfit: { $subtract: ["$saleAmount", "$costAmount"] },
              },
            },
            { $sort: { grossProfit: -1, soldQty: -1 } },
            { $limit: 10 },
          ])
        : Promise.resolve([]),
      canViewSensitiveFinancials(req)
        ? Sale.aggregate([
            {
              $match: {
                ...saleQuery,
                createdAt: { $gte: trendStart, ...(saleQuery.createdAt || {}) },
              },
            },
            {
              $addFields: {
                totalNetAmount: {
                  $subtract: [
                    { $ifNull: ["$totalAmount", 0] },
                    { $ifNull: ["$returnedAmount", 0] },
                  ],
                },
                totalCostAmount: {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "item",
                      in: {
                        $multiply: [
                          {
                            $max: [
                              {
                                $subtract: [
                                  { $toDouble: { $ifNull: ["$$item.quantity", 0] } },
                                  { $toDouble: { $ifNull: ["$$item.returnedQuantity", 0] } },
                                ],
                              },
                              0,
                            ],
                          },
                          { $toDouble: { $ifNull: ["$$item.purchasePrice", 0] } },
                        ],
                      },
                    },
                  },
                },
              },
            },
            {
              $group: {
                _id: {
                  y: { $year: "$createdAt" },
                  m: { $month: "$createdAt" },
                  d: { $dayOfMonth: "$createdAt" },
                },
                saleAmount: { $sum: "$totalNetAmount" },
                costAmount: { $sum: "$totalCostAmount" },
              },
            },
            { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
          ])
        : Promise.resolve([]),
    ]);

    const profitTrend = canViewSensitiveFinancials(req)
      ? (() => {
          const start = new Date(trendStart);
          start.setHours(0, 0, 0, 0);
          const endBase = dateTo ? new Date(dateTo) : new Date();
          endBase.setHours(0, 0, 0, 0);
          const labels = [];
          const keys = [];
          for (
            let dt = new Date(start);
            dt.getTime() <= endBase.getTime();
            dt.setDate(dt.getDate() + 1)
          ) {
            labels.push(dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
            keys.push(`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`);
          }

          const map = new Map(
            dailyProfitAgg.map((row) => [
              `${row._id.y}-${row._id.m}-${row._id.d}`,
              {
                saleAmount: Number(row.saleAmount || 0),
                costAmount: Number(row.costAmount || 0),
                grossProfit: Number((Number(row.saleAmount || 0) - Number(row.costAmount || 0)).toFixed(2)),
              },
            ]),
          );

          return {
            labels,
            sales: keys.map((key) => Number(map.get(key)?.saleAmount || 0)),
            cost: keys.map((key) => Number(map.get(key)?.costAmount || 0)),
            profit: keys.map((key) => Number(map.get(key)?.grossProfit || 0)),
          };
        })()
      : { labels: [], sales: [], cost: [], profit: [] };

    return res.status(200).json({
      success: true,
      data: {
        sales: {
          count: Number(salesAgg[0]?.count || 0),
          totalAmount: Number(salesAgg[0]?.totalAmount || 0),
          totalCostAmount: canViewSensitiveFinancials(req)
            ? Number(salesAgg[0]?.totalCostAmount || 0)
            : 0,
          grossProfit: canViewSensitiveFinancials(req)
            ? Number(
                (Number(salesAgg[0]?.totalAmount || 0) - Number(salesAgg[0]?.totalCostAmount || 0)).toFixed(2),
              )
            : 0,
          grossMarginPercent:
            canViewSensitiveFinancials(req) && Number(salesAgg[0]?.totalAmount || 0) > 0
              ? Number(
                  (
                    ((Number(salesAgg[0]?.totalAmount || 0) - Number(salesAgg[0]?.totalCostAmount || 0)) /
                      Number(salesAgg[0]?.totalAmount || 0)) *
                    100
                  ).toFixed(2),
                )
              : 0,
          totalPaid: Number(salesAgg[0]?.totalPaid || 0),
          totalDue: Number(salesAgg[0]?.totalDue || 0),
          totalReturnedQty: Number(salesAgg[0]?.totalReturnedQty || 0),
          totalReturnedAmount: Number(salesAgg[0]?.totalReturnedAmount || 0),
          totalRefundedAmount: Number(salesAgg[0]?.totalRefundedAmount || 0),
        },
        returns: {
          count: Number(returnAgg[0]?.count || 0),
          totalAmount: Number(returnAgg[0]?.totalAmount || 0),
          totalRefund: Number(returnAgg[0]?.totalRefund || 0),
          totalCredit: Number(returnAgg[0]?.totalCredit || 0),
          totalDueAdjusted: Number(returnAgg[0]?.totalDueAdjusted || 0),
          totalQty: Number(returnAgg[0]?.totalQty || 0),
        },
        profitByItem: canViewSensitiveFinancials(req)
          ? itemProfitAgg.map((row) => ({
              itemName: row._id?.itemName || "Unnamed Product",
              modelName: row._id?.model || "",
              soldQty: Number(row.soldQty || 0),
              saleAmount: Number(row.saleAmount || 0),
              costAmount: Number(row.costAmount || 0),
              grossProfit: Number(row.grossProfit || 0),
              grossMarginPercent:
                Number(row.saleAmount || 0) > 0
                  ? Number(((Number(row.grossProfit || 0) / Number(row.saleAmount || 0)) * 100).toFixed(2))
                  : 0,
            }))
          : [],
        profitByCustomer: canViewSensitiveFinancials(req)
          ? customerProfitAgg.map((row) => ({
              customerName: row._id?.customerName || "Walk-in",
              billCount: Number(row.billCount || 0),
              saleAmount: Number(row.saleAmount || 0),
              costAmount: Number(row.costAmount || 0),
              grossProfit: Number(row.grossProfit || 0),
              grossMarginPercent:
                Number(row.saleAmount || 0) > 0
                  ? Number(((Number(row.grossProfit || 0) / Number(row.saleAmount || 0)) * 100).toFixed(2))
                  : 0,
            }))
          : [],
        profitByCategory: canViewSensitiveFinancials(req)
          ? categoryProfitAgg.map((row) => ({
              categoryName: row._id?.categoryName || "Uncategorized",
              soldQty: Number(row.soldQty || 0),
              saleAmount: Number(row.saleAmount || 0),
              costAmount: Number(row.costAmount || 0),
              grossProfit: Number(row.grossProfit || 0),
              grossMarginPercent:
                Number(row.saleAmount || 0) > 0
                  ? Number(((Number(row.grossProfit || 0) / Number(row.saleAmount || 0)) * 100).toFixed(2))
                  : 0,
            }))
          : [],
        profitTrend,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error loading sales report overview",
      error: "Internal server error",
    });
  }
};

exports.createSaleReturn = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale id" });
    }

    const sale = await Sale.findOne({ _id: id, shop: req.shopId });
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found for selected shop" });
    }

    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!payloadItems.length) {
      return res.status(400).json({ success: false, message: "Return items are required" });
    }

    const returnedMap = await sumSaleReturnedByVariation({
      shopId: req.shopId,
      saleId: sale._id,
    });

    const hasRemaining = (sale.items || []).some((it) => {
      const variationKey = `${it?.variationId || ""}`;
      if (!variationKey) return false;
      const soldQty = Number(it?.quantity || 0);
      const alreadyReturned = Number(returnedMap.get(variationKey) || 0);
      return soldQty - alreadyReturned > 0;
    });
    if (!hasRemaining) {
      return res.status(409).json({
        success: false,
        message: "All quantities for this sale are already returned",
      });
    }

    const saleItemMap = new Map();
    (sale.items || []).forEach((it) => {
      if (it?.variationId) {
        saleItemMap.set(`${it.variationId}`, it);
      }
      if (it?.variationSku) {
        saleItemMap.set(`sku:${it.variationSku}`, it);
      }
    });

    const returnItems = [];
    for (const raw of payloadItems) {
      const variationId = `${raw?.variationId || ""}`.trim();
      const variationSku = `${raw?.variationSku || ""}`.trim();
      const qty = Math.max(0, Number(raw?.quantity || 0));
      if (qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Each return item must have quantity greater than 0",
        });
      }

      const saleItem =
        (variationId && saleItemMap.get(variationId)) ||
        (variationSku && saleItemMap.get(`sku:${variationSku}`));
      if (!saleItem) {
        return res.status(400).json({
          success: false,
          message: "Invalid sale item/variation for this invoice",
        });
      }

      const variationKey = `${saleItem.variationId || ""}`;
      if (!variationKey) {
        return res.status(400).json({
          success: false,
          message: `Sale item ${saleItem.itemName || ""} does not have variation mapping`,
        });
      }

      const soldQty = Number(saleItem.quantity || 0);
      const alreadyReturned = Number(returnedMap.get(variationKey) || 0);
      const remainingQty = Math.max(0, soldQty - alreadyReturned);
      if (qty > remainingQty) {
        return res.status(400).json({
          success: false,
          message: `Return qty exceeds remaining for SKU ${saleItem.variationSku || "-"}. Sold: ${soldQty}, Already Returned: ${alreadyReturned}, Remaining: ${remainingQty}`,
        });
      }

      const sellingPrice = Number(saleItem.sellingPrice || 0);
      const reason = raw?.reason || "OTHER";
      returnItems.push({
        item: saleItem.item,
        variationId: saleItem.variationId,
        variationSku: saleItem.variationSku,
        itemName: saleItem.itemName || "",
        model: saleItem.model || "",
        size: saleItem.size || "",
        color: saleItem.color || "",
        quantity: qty,
        damagedReceivedQuantity: reason === "DAMAGED" ? qty : 0,
        sellingPrice,
        totalAmount: Number((qty * sellingPrice).toFixed(2)),
        reason,
        note: raw?.note || "",
      });
    }

    const totalQuantity = returnItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const totalAmount = Number(
      returnItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0).toFixed(2),
    );

    const currentDue = getSaleCollectibleDue(sale);
    const dueAdjustedAmount = Math.min(currentDue, totalAmount);
    const refundableMax = Math.max(0, Number((totalAmount - dueAdjustedAmount).toFixed(2)));

    const refundMethod = `${req.body?.refundMethod || "CASH"}`.trim().toUpperCase();
    if (!ALLOWED_REFUND_METHODS.has(refundMethod)) {
      return res.status(400).json({ success: false, message: "Invalid refund method" });
    }
    const refundAmount = Math.max(0, Number(req.body?.refundAmount ?? refundableMax));
    if (refundAmount > refundableMax) {
      return res.status(400).json({
        success: false,
        message: `Refund amount cannot exceed ${refundableMax.toFixed(2)} after due adjustment`,
      });
    }
    const creditAmount = Math.max(0, Number((refundableMax - refundAmount).toFixed(2)));

    const variationIds = [...new Set(returnItems.map((it) => `${it.variationId}`))];
    const variations = await ProductVariation.find({
      _id: { $in: variationIds },
      shop: req.shopId,
    }).select("_id product model sku");
    const variationMap = new Map(variations.map((v) => [`${v._id}`, v]));
    if (variationMap.size !== variationIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more return variations are invalid for selected shop",
      });
    }

    const saleReturn = await SaleReturn.create({
      shop: req.shopId,
      sale: sale._id,
      customerName: sale.customerName || "Walk-in",
      items: returnItems,
      totalQuantity,
      totalAmount,
      refundMethod,
      refundAmount,
      dueAdjustedAmount,
      creditAmount,
      note: req.body?.note || "",
      status: "APPROVED",
      createdBy: req.user?._id,
    });

    for (const item of returnItems) {
      const variation = variationMap.get(`${item.variationId}`);
      const { stock } = await applyStockTransaction({
        shop: req.shopId,
        product: variation.product,
        model: variation.model,
        variation: variation._id,
        sku: variation.sku || item.variationSku,
        type: "IN",
        quantity: Number(item.quantity || 0),
        referenceType: "RETURN",
        referenceId: saleReturn._id,
        note: `Sales return ${sale._id}`,
        createdBy: req.user?._id,
      });

      if (Number(item.damagedReceivedQuantity || 0) > 0) {
        const previousQuantity = Number(stock?.quantity || 0);
        stock.damagedQuantity = Number(stock.damagedQuantity || 0) + Number(item.damagedReceivedQuantity || 0);
        await stock.save();

        await StockTransaction.create({
          shop: req.shopId,
          product: variation.product,
          model: variation.model,
          variation: variation._id,
          sku: variation.sku || item.variationSku,
          type: "DAMAGED",
          quantity: Number(item.damagedReceivedQuantity || 0),
          deltaQuantity: 0,
          previousQuantity,
          newQuantity: previousQuantity,
          referenceType: "RETURN",
          referenceId: saleReturn._id,
          note: `Customer return received damaged ${sale._id}`,
          damageSource: "CUSTOMER_RETURN_DAMAGE",
          createdBy: req.user?._id,
        });
      }
    }

    const mergedReturnedMap = await sumSaleReturnedByVariation({
      shopId: req.shopId,
      saleId: sale._id,
    });
    const returnTotals = await getSaleReturnTotals({
      shopId: req.shopId,
      saleId: sale._id,
    });
    const remainingByVariation = new Map();
    mergedReturnedMap.forEach((qty, key) => {
      remainingByVariation.set(key, Number(qty || 0));
    });

    sale.items = (sale.items || []).map((it) => {
      const variationKey = `${it?.variationId || ""}`;
      const soldQty = Number(it?.quantity || 0);
      const currentRemaining = variationKey
        ? Number(remainingByVariation.get(variationKey) || 0)
        : 0;
      const returnedQty = Math.min(soldQty, Math.max(0, currentRemaining));
      if (variationKey) {
        remainingByVariation.set(variationKey, Math.max(0, currentRemaining - returnedQty));
      }
      return {
        ...it.toObject(),
        returnedQuantity: returnedQty,
      };
    });
    sale.returnedQuantity = Math.min(Number(sale.totalQuantity || 0), Number(returnTotals.qty || 0));
    sale.returnedAmount = Number(returnTotals.amount || 0);
    sale.refundedAmount = Number(returnTotals.refund || 0);
    sale.dueAdjustedAmount = Number(returnTotals.dueAdjusted || 0);
    sale.creditedAmount = Number(returnTotals.credit || 0);
    sale.dueAmount = getSaleCollectibleDue(sale);
    const fullyReturned = Number(sale.returnedQuantity || 0) >= Number(sale.totalQuantity || 0);
    sale.status = fullyReturned ? "RETURNED" : "COMPLETED";
    await sale.save();

    if (dueAdjustedAmount > 0) {
      await createSaleLedgerEntry({
        shop: req.shopId,
        sale: sale._id,
        customer: sale.customer,
        customerName: sale.customerName,
        type: "return_due_adjustment",
        amount: dueAdjustedAmount,
        referenceId: saleReturn._id,
        note: `Sales return due adjust ${saleReturn._id}`,
        createdBy: req.user?._id,
      });
    }
    if (refundAmount > 0) {
      await createSaleLedgerEntry({
        shop: req.shopId,
        sale: sale._id,
        customer: sale.customer,
        customerName: sale.customerName,
        type: "return_refund",
        amount: refundAmount,
        paymentMethod: refundMethod,
        referenceId: saleReturn._id,
        note: `Sales return refund (${refundMethod}) ${saleReturn._id}`,
        createdBy: req.user?._id,
      });
    }
    if (creditAmount > 0) {
      await createSaleLedgerEntry({
        shop: req.shopId,
        sale: sale._id,
        customer: sale.customer,
        customerName: sale.customerName,
        type: "return_credit",
        amount: creditAmount,
        paymentMethod: "STORE_CREDIT",
        referenceId: saleReturn._id,
        note: `Sales return credit note ${saleReturn._id}`,
        createdBy: req.user?._id,
      });
    }

    if (sale.customer) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: sale.customer,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Sale return created",
      data: saleReturn,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating sale return",
      error: "Internal server error",
    });
  }
};
