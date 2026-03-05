const mongoose = require("mongoose");
const Sale = require("../models/CustomerSale");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const ProductVariation = require("../models/ProductVariation");
const Stock = require("../models/Stock");
const { applyStockTransaction } = require("../utils/stock.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const resolveVariation = async (shopId, rawItem = {}) => {
  const variationId = `${rawItem?.variationId || ""}`.trim();
  const variationSku = `${rawItem?.variationSku || rawItem?.variations || ""}`.trim();

  if (variationId && mongoose.Types.ObjectId.isValid(variationId)) {
    const byId = await ProductVariation.findOne({ _id: variationId, shop: shopId })
      .populate("product", "name brand category")
      .populate("model", "name");
    if (byId) return byId;
  }

  if (variationSku) {
    const bySku = await ProductVariation.findOne({ shop: shopId, sku: variationSku })
      .populate("product", "name brand category")
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
    .populate("product", "name brand category")
    .populate("model", "name");
};

exports.createSale = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const {
      customerName = "Walk-in",
      items = [],
      paymentMethod = "CASH",
      billDiscount = 0,
      paidAmount = 0,
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "items[] is required" });
    }

    const normalizedItems = [];

    for (const raw of items) {
      const qty = Math.max(0, Number(raw?.quantity || 0));
      if (qty <= 0) {
        return res.status(400).json({ success: false, message: "Item quantity must be greater than 0" });
      }

      const variation = await resolveVariation(req.shopId, raw);
      if (!variation) {
        return res.status(400).json({
          success: false,
          message: `Variation not found for item ${raw?.itemName || raw?.variationSku || "unknown"}`,
        });
      }

      const stock = await Stock.findOne({ shop: req.shopId, variation: variation._id });
      const available = Number(stock?.quantity || 0);
      if (available < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for SKU ${variation.sku}. Available: ${available}, Requested: ${qty}`,
        });
      }

      const sellingPrice = Number(raw?.purchasePrice || variation?.sellingPrice || 0);
      const costPrice = Number(variation?.costPrice || 0);
      const lineTotal = Number((qty * sellingPrice).toFixed(2));

      normalizedItems.push({
        item: variation.product?._id || variation.product,
        variationId: variation._id,
        variationSku: variation.sku,
        itemName: variation.product?.name || raw?.itemName || "Item",
        model: variation.model?.name || raw?.model || "",
        size: variation.attributes?.size || raw?.size || "",
        color: variation.attributes?.color || raw?.color || "",
        categoryName: "",
        brandName: "",
        quantity: qty,
        purchasePrice: costPrice,
        sellingPrice,
        discount: 0,
        discountType: "FLAT",
        total: lineTotal,
        _variationRef: variation,
      });
    }

    const totalQuantity = normalizedItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const subTotal = normalizedItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
    const safeBillDiscount = Math.max(0, Number(billDiscount || 0));
    const totalAmount = Math.max(0, Number((subTotal - safeBillDiscount).toFixed(2)));
    const safePaidAmount = Math.max(0, Number(paidAmount || 0));
    if (safePaidAmount > totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be greater than net bill amount",
      });
    }
    const allowedPaymentMethods = new Set(["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT"]);
    const normalizedPaymentMethod = `${paymentMethod || "CASH"}`.trim().toUpperCase();
    if (!allowedPaymentMethods.has(normalizedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const saleDocItems = normalizedItems.map((it) => {
      const output = { ...it };
      delete output._variationRef;
      return output;
    });

    const sale = await Sale.create({
      shop: req.shopId,
      customerName,
      items: saleDocItems,
      totalQuantity,
      subTotal,
      billDiscount: safeBillDiscount,
      totalAmount,
      paymentMethod: normalizedPaymentMethod,
      paidAmount: safePaidAmount,
      dueAmount: Math.max(0, Number((totalAmount - safePaidAmount).toFixed(2))),
      orderSource: "POS",
      status: "COMPLETED",
    });

    for (const it of normalizedItems) {
      const variation = it._variationRef;
      await applyStockTransaction({
        shop: req.shopId,
        product: variation.product?._id || variation.product,
        model: variation.model?._id || variation.model,
        variation: variation._id,
        sku: variation.sku,
        type: "OUT",
        quantity: Number(it.quantity || 0),
        referenceType: "SALE",
        referenceId: sale._id,
        note: `POS sale ${sale._id}`,
        createdBy: req.user?._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      sale,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating sale",
      error: error.message,
    });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { page = 1, perPage = 10, itemName, customerName, startDate, endDate } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(perPage || 10)));
    const skip = (safePage - 1) * safeLimit;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (customerName && customerName !== "null") {
      query.customerName = { $regex: customerName, $options: "i" };
    }

    if (itemName && itemName !== "null") {
      query["items.itemName"] = { $regex: itemName, $options: "i" };
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

    const [rows, totalItems] = await Promise.all([
      Sale.find(query).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Sale.countDocuments(query),
    ]);

    const itemResults = rows.map((s) => ({
      _id: s._id,
      customerName: s.customerName || "Walk-in",
      totalPurchasePrice: Number(s.totalAmount || 0),
      billDiscount: Number(s.billDiscount || 0),
      paidAmount: Number(s.paidAmount || 0),
      dueAmount: Number(s.dueAmount || 0),
      totalQuantity: Number(s.totalQuantity || 0),
      purchaseDate: s.createdAt,
      paymentMethod: s.paymentMethod,
      status: s.status,
      items: (s.items || []).map((it) => ({
        itemName: it.itemName || "-",
        brand: { name: it.brandName || "-" },
        category: { name: it.categoryName || "-" },
        model: it.model || "-",
        size: it.size || "-",
        quantity: Number(it.quantity || 0),
        purchasePrice: Number(it.sellingPrice || 0),
      })),
    }));

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
      error: error.message,
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
      error: error.message,
    });
  }
};
