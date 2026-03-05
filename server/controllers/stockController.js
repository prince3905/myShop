const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const StockTransaction = require("../models/StockTransaction");
const { applyStockTransaction } = require("../utils/stock.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

exports.getStockReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      lowStock = "false",
      sortBy = "updatedAt",
      order = "desc",
    } = req.query;

    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;
    const sortDir = order === "asc" ? 1 : -1;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (search) {
      const regex = new RegExp(search, "i");
      const [productMatches, modelMatches] = await Promise.all([
        Product.find({ name: regex }).select("_id").lean(),
        ProductModel.find({ name: regex }).select("_id").lean(),
      ]);

      const productIds = productMatches.map((p) => p._id);
      const modelIds = modelMatches.map((m) => m._id);

      query.$or = [{ sku: regex }];
      if (productIds.length) query.$or.push({ product: { $in: productIds } });
      if (modelIds.length) query.$or.push({ model: { $in: modelIds } });
    }

    if (String(lowStock) === "true") {
      query.$expr = { $lte: ["$quantity", "$reorderLevel"] };
    }

    const [rows, total] = await Promise.all([
      Stock.find(query)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(safeLimit)
        .populate("shop", "name shopCode")
        .populate("product", "name")
        .populate("model", "name")
        .populate("variation", "sku attributes"),
      Stock.countDocuments(query),
    ]);

    const summaryRows = await Stock.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalReserved: { $sum: "$reservedQuantity" },
          totalDamaged: { $sum: "$damagedQuantity" },
          totalCostValue: { $sum: { $multiply: ["$quantity", "$lastPurchasePrice"] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0],
            },
          },
        },
      },
    ]);
    const summary = summaryRows[0] || {};

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      stockReport: rows,
      summary: {
        totalQuantity: Number(summary.totalQuantity || 0),
        totalReserved: Number(summary.totalReserved || 0),
        totalDamaged: Number(summary.totalDamaged || 0),
        totalCostValue: Number(summary.totalCostValue || 0),
        lowStockCount: Number(summary.lowStockCount || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving stock report",
      error: error.message,
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, variation, type, referenceType, search = "" } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (variation) query.variation = variation;
    if (type) query.type = type;
    if (referenceType) query.referenceType = referenceType;
    if (search) query.sku = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      StockTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("shop", "name shopCode")
        .populate("product", "name")
        .populate("model", "name")
        .populate("variation", "sku attributes")
        .populate("createdBy", "email role"),
      StockTransaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving stock transactions",
      error: error.message,
    });
  }
};

exports.manualAdjust = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { variation, type = "ADJUSTMENT", quantity, note = "" } = req.body;
    if (!variation || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "variation and quantity are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(variation)) {
      return res.status(400).json({ success: false, message: "Invalid variation id" });
    }

    const variationDoc = await ProductVariation.findOne({
      _id: variation,
      shop: req.shopId,
    });

    if (!variationDoc) {
      return res.status(404).json({ success: false, message: "Variation not found for selected shop" });
    }

    const { stock, tx } = await applyStockTransaction({
      shop: req.shopId,
      product: variationDoc.product,
      model: variationDoc.model,
      variation: variationDoc._id,
      sku: variationDoc.sku,
      type,
      quantity: Number(quantity),
      referenceType: "MANUAL",
      note,
      createdBy: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: { stock, transaction: tx },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error adjusting stock",
      error: error.message,
    });
  }
};
