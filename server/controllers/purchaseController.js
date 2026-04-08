const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const PurchaseReturn = require("../models/PurchaseReturn");
const Distributor = require("../models/Distributor");
const ProductVariation = require("../models/ProductVariation");
const Stock = require("../models/Stock");
const StockTransaction = require("../models/StockTransaction");
const DistributorLedger = require("../models/DistributorLedger");
const { applyStockTransaction } = require("../utils/stock.service");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");
const { generateInvoiceNo } = require("../utils/invoice.service");
const { syncPurchaseSnapshot } = require("../utils/purchaseAccount.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;
const ALLOWED_PAYMENT_METHODS = new Set([
  "CASH",
  "BANK",
  "ONLINE",
  "UPI",
  "CARD",
  "CHEQUE",
]);

const normalizePaymentMethod = (value) => `${value || "CASH"}`.trim().toUpperCase();

const calcTotals = (items = [], discountAmount = 0) => {
  let subtotal = 0;
  let taxAmount = 0;

  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const freeQuantity = Number(item.freeQuantity || 0);
    const purchasePrice = Number(item.purchasePrice || 0);
    const taxPercent = Number(item.taxPercent || 0);
    const lineBase = quantity * purchasePrice;
    const lineTax = (lineBase * taxPercent) / 100;
    const lineDiscount = Number(item.discountAmount || 0);
    const totalAmount = Math.max(0, lineBase + lineTax - lineDiscount);

    subtotal += lineBase;
    taxAmount += lineTax;

    return {
      ...item,
      quantity,
      freeQuantity,
      purchasePrice,
      taxPercent,
      discountAmount: lineDiscount,
      totalAmount,
    };
  });

  const safeDiscount = Number(discountAmount || 0);
  const grandTotal = Math.max(
    0,
    normalizedItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0) -
      safeDiscount,
  );

  return {
    items: normalizedItems,
    subtotal,
    taxAmount,
    discountAmount: safeDiscount,
    grandTotal,
  };
};

const buildNormalizedPurchaseItems = async (shopId, items = []) => {
  const variationIds = (items || []).map((i) => i.variation).filter(Boolean);
  if (!variationIds.length) {
    return { error: "At least one variation is required", items: [] };
  }

  const uniqueVariationIds = [...new Set(variationIds.map((id) => `${id}`))];
  const variations = await ProductVariation.find({
    _id: { $in: uniqueVariationIds },
    shop: shopId,
  }).select("_id product model sku");

  if (variations.length !== uniqueVariationIds.length) {
    return {
      error: "One or more variations are invalid for selected shop",
      items: [],
    };
  }

  const variationMap = new Map(variations.map((v) => [`${v._id}`, v]));
  const normalized = [];

  for (const item of items) {
    const variationId = `${item?.variation || ""}`;
    const variation = variationMap.get(variationId);
    if (!variation) {
      return {
        error: "One or more variations are invalid for selected shop",
        items: [],
      };
    }

    normalized.push({
      variation: variation._id,
      product: variation.product,
      model: variation.model,
      sku: variation.sku,
      quantity: Number(item?.quantity || 0),
      freeQuantity: Number(item?.freeQuantity || 0),
      purchasePrice: Number(item?.purchasePrice || 0),
      taxPercent: Number(item?.taxPercent || 0),
      discountAmount: Number(item?.discountAmount || 0),
    });
  }

  return { error: null, items: normalized };
};

exports.createDraft = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const {
      distributor,
      invoiceNo,
      purchaseDate,
      items = [],
      discountAmount = 0,
      paidAmount = 0,
      paymentMethod = "CASH",
      note,
    } = req.body;
    if (!distributor || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "distributor and items[] are required",
      });
    }

    const distributorExists = await Distributor.findOne({
      _id: distributor,
      shop: req.shopId,
      isDeleted: { $ne: true },
    });
    if (!distributorExists) {
      return res.status(404).json({ success: false, message: "Distributor not found for selected shop" });
    }

    const { error: itemError, items: normalizedItems } = await buildNormalizedPurchaseItems(
      req.shopId,
      items,
    );
    if (itemError) {
      return res.status(400).json({ success: false, message: itemError });
    }

    const totals = calcTotals(normalizedItems, discountAmount);
    const paid = Math.max(0, Number(paidAmount || 0));
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!ALLOWED_PAYMENT_METHODS.has(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
    if (paid > totals.grandTotal) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be greater than grand total",
      });
    }

    const normalizedInvoiceNo = `${invoiceNo || ""}`.trim() || (await generateInvoiceNo({ type: "PURCHASE" }));

    const purchase = await Purchase.create({
      shop: req.shopId,
      distributor,
      invoiceNo: normalizedInvoiceNo,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      status: "DRAFT",
      items: totals.items,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      grandTotal: totals.grandTotal,
      paidAmount: paid,
      paymentMethod: normalizedPaymentMethod,
      dueAmount: Math.max(0, totals.grandTotal - paid),
      note,
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase draft created",
      data: purchase,
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.invoiceNo) {
      return res.status(409).json({ success: false, message: "Invoice number already exists for this shop" });
    }
    return res.status(500).json({ success: false, message: "Error creating purchase draft", error: "Internal server error" });
  }
};

exports.confirmPurchase = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase id" });
    }

    const purchase = await Purchase.findOne({ _id: id, shop: req.shopId });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    if (purchase.status === "CONFIRMED") {
      return res.status(409).json({
        success: false,
        message: "Purchase already confirmed",
      });
    }
    if (purchase.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cancelled purchase cannot be confirmed",
      });
    }
    if (!`${purchase.invoiceNo || ""}`.trim()) {
      purchase.invoiceNo = await generateInvoiceNo({ type: "PURCHASE" });
    }

    for (const item of purchase.items) {
      const qty = Number(item.quantity || 0) + Number(item.freeQuantity || 0);
      if (qty <= 0) {
        continue;
      }

      const txExists = await StockTransaction.exists({
        shop: req.shopId,
        referenceType: "PURCHASE",
        referenceId: purchase._id,
        variation: item.variation,
        type: "IN",
      });
      if (txExists) {
        continue;
      }

      await applyStockTransaction({
        shop: req.shopId,
        product: item.product,
        model: item.model,
        variation: item.variation,
        sku: item.sku,
        type: "IN",
        quantity: qty,
        referenceType: "PURCHASE",
        referenceId: purchase._id,
        note: `Purchase confirm ${purchase.invoiceNo || purchase._id}`,
        createdBy: req.user?._id,
      });
    }

    if (purchase.grandTotal > 0) {
      const ledgerExists = await DistributorLedger.exists({
        shop: req.shopId,
        distributor: purchase.distributor,
        type: "purchase",
        referenceId: purchase._id,
        isDeleted: false,
      });

      if (!ledgerExists) {
        await createDistributorLedgerEntry({
          shop: req.shopId,
          distributor: purchase.distributor,
          type: "purchase",
          amount: Number(purchase.grandTotal || 0),
          referenceId: purchase._id,
          note: `Purchase ${purchase.invoiceNo || purchase._id}`,
          transactionDate: new Date(),
          createdBy: req.user?._id,
        });
      }
    }

    const paidAmount = Math.max(0, Number(purchase.paidAmount || 0));
    if (paidAmount > 0) {
      const paymentLedgerExists = await DistributorLedger.exists({
        shop: req.shopId,
        distributor: purchase.distributor,
        type: "payment",
        referenceId: purchase._id,
        isDeleted: false,
      });

      if (!paymentLedgerExists) {
        await createDistributorLedgerEntry({
          shop: req.shopId,
          distributor: purchase.distributor,
          type: "payment",
          amount: paidAmount,
          paymentMethod: purchase.paymentMethod || "CASH",
          referenceId: purchase._id,
          note: `Purchase payment (${purchase.paymentMethod || "CASH"}) ${purchase.invoiceNo || purchase._id}`,
          transactionDate: new Date(),
          createdBy: req.user?._id,
        });
      }
    }

    purchase.status = "CONFIRMED";
    purchase.confirmedAt = new Date();
    purchase.confirmedBy = req.user?._id;
    await purchase.save();
    await syncPurchaseSnapshot({ purchaseId: purchase._id, shopId: req.shopId });

    return res.status(200).json({
      success: true,
      message: "Purchase confirmed and stock updated",
      data: await Purchase.findById(purchase._id),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error confirming purchase", error: "Internal server error" });
  }
};

exports.listPurchases = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status,
      returnStatus,
      distributor,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;
    const allowedSortFields = new Set(["createdAt", "purchaseDate", "grandTotal", "status", "invoiceNo"]);
    const safeSortBy = allowedSortFields.has(`${sortBy}`) ? `${sortBy}` : "createdAt";
    const sortDir = `${order}`.toLowerCase() === "asc" ? 1 : -1;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (status) query.status = status;
    if (distributor) query.distributor = distributor;
    if (search) {
      query.$or = [{ invoiceNo: { $regex: search, $options: "i" } }];
    }
    if (dateFrom || dateTo) {
      query.purchaseDate = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid dateFrom" });
        }
        query.purchaseDate.$gte = from;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid dateTo" });
        }
        end.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = end;
      }
    }

    const enrichPurchases = async (items = []) => {
      const purchaseIds = items.map((p) => p?._id).filter(Boolean);
      const paymentLedgers = purchaseIds.length
        ? await DistributorLedger.find({
            shop: isSuperAdminGlobal(req) ? { $exists: true } : req.shopId,
            type: "payment",
            referenceId: { $in: purchaseIds },
            isDeleted: false,
          })
            .sort({ createdAt: -1 })
            .select("referenceId paymentMethod")
        : [];
      const paymentByRef = new Map();
      paymentLedgers.forEach((entry) => {
        const ref = `${entry?.referenceId || ""}`;
        if (!ref || paymentByRef.has(ref)) return;
        paymentByRef.set(ref, `${entry?.paymentMethod || ""}`.trim().toUpperCase());
      });
      const data = items.map((p) => {
        const key = `${p?._id || ""}`;
        const fromPurchase = `${p?.paymentMethod || ""}`.trim().toUpperCase();
        const fromLedger = `${paymentByRef.get(key) || ""}`.trim().toUpperCase();
        const purchasedQty = Array.isArray(p?.items)
          ? p.items.reduce(
              (acc, it) => acc + Number(it?.quantity || 0),
              0,
            )
          : 0;

        return {
          ...p.toObject(),
          paymentMethodResolved: fromPurchase || fromLedger || (Number(p?.paidAmount || 0) > 0 ? "CASH" : "-"),
          purchasedQty,
        };
      });

      const purchaseIdsForReturns = data.map((p) => p?._id).filter(Boolean);
      const returnAgg = purchaseIdsForReturns.length
        ? await PurchaseReturn.aggregate([
            {
              $match: {
                ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
                purchase: { $in: purchaseIdsForReturns },
                status: "APPROVED",
              },
            },
            {
              $group: {
                _id: "$purchase",
                count: { $sum: 1 },
                totalReturnedQty: { $sum: "$totalQuantity" },
                totalReturnedAmount: { $sum: "$totalAmount" },
              },
            },
          ])
        : [];
      const returnMap = new Map(
        returnAgg.map((r) => [
          `${r._id}`,
          {
            count: Number(r.count || 0),
            totalReturnedQty: Number(r.totalReturnedQty || 0),
            totalReturnedAmount: Number(r.totalReturnedAmount || 0),
          },
        ]),
      );

      return data.map((p) => {
        const key = `${p?._id || ""}`;
        const ret = returnMap.get(key) || {
          count: 0,
          totalReturnedQty: 0,
          totalReturnedAmount: 0,
        };
        const purchasedQty = Number(p?.purchasedQty || 0);
        let computedReturnStatus = "NONE";
        if (ret.totalReturnedQty > 0 && ret.totalReturnedQty < purchasedQty) {
          computedReturnStatus = "PARTIAL";
        } else if (purchasedQty > 0 && ret.totalReturnedQty >= purchasedQty) {
          computedReturnStatus = "FULL";
        }
        return {
          ...p,
          returnCount: ret.count,
          returnedQty: ret.totalReturnedQty,
          returnedAmount: Number(p?.returnedAmount ?? ret.totalReturnedAmount ?? 0),
          returnStatus: computedReturnStatus,
        };
      });
    };

    const normalizedReturnStatus = `${returnStatus || ""}`.trim().toUpperCase();
    if (normalizedReturnStatus && !["NONE", "PARTIAL", "FULL"].includes(normalizedReturnStatus)) {
      return res.status(400).json({ success: false, message: "Invalid returnStatus" });
    }

    let total = 0;
    let enrichedData = [];
    if (normalizedReturnStatus) {
      const allItems = await Purchase.find(query)
        .sort({ [safeSortBy]: sortDir, _id: -1 })
        .populate("distributor", "name phone")
        .populate("shop", "name shopCode")
        .populate("createdBy", "email role");
      const enrichedAll = await enrichPurchases(allItems);
      const filtered = enrichedAll.filter((p) => `${p?.returnStatus || "NONE"}` === normalizedReturnStatus);
      total = filtered.length;
      enrichedData = filtered.slice(skip, skip + safeLimit);
    } else {
      const [items, count] = await Promise.all([
        Purchase.find(query)
          .sort({ [safeSortBy]: sortDir, _id: -1 })
          .skip(skip)
          .limit(safeLimit)
          .populate("distributor", "name phone")
          .populate("shop", "name shopCode")
          .populate("createdBy", "email role"),
        Purchase.countDocuments(query),
      ]);
      total = count;
      enrichedData = await enrichPurchases(items);
    }

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      data: enrichedData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error listing purchases", error: "Internal server error" });
  }
};

exports.getPurchaseById = async (req, res) => {
  try {
    const ref = `${req.params.id || ""}`.trim();
    const hasObjectId = mongoose.Types.ObjectId.isValid(ref);
    const query = isSuperAdminGlobal(req)
      ? hasObjectId
        ? { $or: [{ _id: ref }, { invoiceNo: ref }] }
        : { invoiceNo: ref }
      : hasObjectId
        ? { shop: req.shopId, $or: [{ _id: ref }, { invoiceNo: ref }] }
        : { shop: req.shopId, invoiceNo: ref };

    let purchase = await Purchase.findOne(query)
      .populate("distributor", "name phone currentBalance")
      .populate("shop", "name shopCode")
      .populate("createdBy", "email role")
      .populate("confirmedBy", "email role")
      .populate("items.product", "name")
      .populate("items.model", "name")
      .populate("items.variation", "sku attributes");

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const syncedPurchase = await syncPurchaseSnapshot({
      purchaseId: purchase._id,
      shopId: isSuperAdminGlobal(req) ? purchase.shop?._id || purchase.shop : req.shopId,
    });
    if (syncedPurchase) {
      purchase = await Purchase.findById(purchase._id)
        .populate("distributor", "name phone currentBalance")
        .populate("shop", "name shopCode")
        .populate("createdBy", "email role")
        .populate("confirmedBy", "email role")
        .populate("items.product", "name")
        .populate("items.model", "name")
        .populate("items.variation", "sku attributes");
    }

    const variationIds = (purchase.items || []).map((item) => item?.variation?._id || item?.variation).filter(Boolean);
    const stockRows = variationIds.length
      ? await Stock.find({
          ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
          variation: { $in: variationIds },
        }).select("variation quantity reservedQuantity damagedQuantity")
      : [];
    const stockMap = new Map(
      stockRows.map((row) => [`${row.variation}`, {
        quantity: Number(row.quantity || 0),
        reservedQuantity: Number(row.reservedQuantity || 0),
        damagedQuantity: Number(row.damagedQuantity || 0),
      }]),
    );

    let paymentMethodResolved = `${purchase?.paymentMethod || ""}`.trim().toUpperCase();
    if (!paymentMethodResolved) {
      const paymentLedger = await DistributorLedger.findOne({
        ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
        type: "payment",
        referenceId: purchase._id,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .select("paymentMethod");
      paymentMethodResolved = `${paymentLedger?.paymentMethod || ""}`.trim().toUpperCase();
    }
    if (!paymentMethodResolved && Number(purchase?.paidAmount || 0) > 0) {
      paymentMethodResolved = "CASH";
    }

    return res.status(200).json({
      success: true,
      data: {
        ...purchase.toObject(),
        items: (purchase.items || []).map((item) => {
          const variationId = `${item?.variation?._id || item?.variation || ""}`;
          const stockSnapshot = stockMap.get(variationId) || {
            quantity: 0,
            reservedQuantity: 0,
            damagedQuantity: 0,
          };
          return {
            ...item.toObject?.() || item,
            stockSnapshot: {
              ...stockSnapshot,
              availableQuantity: Math.max(
                0,
                Number(stockSnapshot.quantity || 0) -
                Number(stockSnapshot.reservedQuantity || 0) -
                Number(stockSnapshot.damagedQuantity || 0),
              ),
            },
          };
        }),
        paymentMethodResolved: paymentMethodResolved || "-",
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching purchase", error: "Internal server error" });
  }
};

exports.updateDraft = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const purchase = await Purchase.findOne({ _id: req.params.id, shop: req.shopId });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }
    if (purchase.status !== "DRAFT") {
      return res.status(400).json({ success: false, message: "Only DRAFT purchase can be updated" });
    }

    const {
      distributor,
      invoiceNo,
      purchaseDate,
      items = [],
      discountAmount = 0,
      paidAmount = 0,
      paymentMethod = "CASH",
      note = "",
    } = req.body;

    if (!distributor || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "distributor and items[] are required",
      });
    }

    const distributorExists = await Distributor.findOne({
      _id: distributor,
      shop: req.shopId,
      isDeleted: { $ne: true },
    });
    if (!distributorExists) {
      return res.status(404).json({ success: false, message: "Distributor not found for selected shop" });
    }

    const { error: itemError, items: normalizedItems } = await buildNormalizedPurchaseItems(
      req.shopId,
      items,
    );
    if (itemError) {
      return res.status(400).json({ success: false, message: itemError });
    }

    const totals = calcTotals(normalizedItems, discountAmount);
    const paid = Math.max(0, Number(paidAmount || 0));
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!ALLOWED_PAYMENT_METHODS.has(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
    if (paid > totals.grandTotal) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be greater than grand total",
      });
    }

    purchase.distributor = distributor;
    purchase.invoiceNo = `${invoiceNo || ""}`.trim() || purchase.invoiceNo || (await generateInvoiceNo({ type: "PURCHASE" }));
    purchase.purchaseDate = purchaseDate ? new Date(purchaseDate) : purchase.purchaseDate;
    purchase.items = totals.items;
    purchase.subtotal = totals.subtotal;
    purchase.taxAmount = totals.taxAmount;
    purchase.discountAmount = totals.discountAmount;
    purchase.grandTotal = totals.grandTotal;
    purchase.paidAmount = paid;
    purchase.paymentMethod = normalizedPaymentMethod;
    purchase.dueAmount = Math.max(0, totals.grandTotal - paid);
    purchase.note = note;
    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase draft updated",
      data: purchase,
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.invoiceNo) {
      return res.status(409).json({ success: false, message: "Invoice number already exists for this shop" });
    }
    return res.status(500).json({
      success: false,
      message: "Error updating purchase draft",
      error: "Internal server error",
    });
  }
};

exports.cancelDraft = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const purchase = await Purchase.findOne({ _id: req.params.id, shop: req.shopId });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }
    if (purchase.status !== "DRAFT") {
      return res.status(400).json({ success: false, message: "Only DRAFT purchase can be cancelled" });
    }

    purchase.status = "CANCELLED";
    purchase.note = `${purchase.note || ""}`.trim();
    await purchase.save();

    return res.status(200).json({
      success: true,
      message: "Purchase draft cancelled",
      data: purchase,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error cancelling purchase draft",
      error: "Internal server error",
    });
  }
};
