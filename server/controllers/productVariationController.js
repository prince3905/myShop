const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const Stock = require("../models/Stock");
const Sale = require("../models/CustomerSale");
const Order = require("../models/order");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { applyStockTransaction } = require("../utils/stock.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitivePricing = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const sanitizeVariationPricing = (variation, req) => {
  if (!variation || canViewSensitivePricing(req)) {
    return variation;
  }

  const plainVariation = variation.toObject?.() || { ...variation };
  delete plainVariation.costPrice;
  return plainVariation;
};

const pushAuditLog = async (userId, action, details = "") => {
  if (!userId) return;
  try {
    await User.findByIdAndUpdate(userId, {
      $push: {
        auditLogs: {
          $each: [{ action, details, createdAt: new Date() }],
          $slice: -50,
        },
      },
    });
  } catch (err) {
    // No-op: audit should not block business flow
  }
};

/* =========================
   CREATE VARIATION
========================= */
exports.createVariation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const {
      product,
      model,
      sku,
      barcode,
      attributes,
      sellingPrice,
      costPrice,
      discount,
      images,
      isActive,
    } = req.body;

    const productExists = await Product.findOne({ _id: product, shop: req.shopId });
    const modelExists = await ProductModel.findOne({
      _id: model,
      product,
      shop: req.shopId,
    });

    if (!productExists || !modelExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid product/model for selected shop",
      });
    }

    const variation = await ProductVariation.create({
      product,
      model,
      sku,
      barcode,
      attributes,
      sellingPrice,
      costPrice,
      quantity: 0,
      discount,
      images,
      isActive,
      shop: req.shopId,
    });

    await Stock.updateOne(
      { shop: req.shopId, variation: variation._id },
      {
        $setOnInsert: {
          shop: req.shopId,
          variation: variation._id,
          quantity: 0,
        },
        $set: {
          product,
          model,
          sku,
        },
      },
      { upsert: true },
    );

    await pushAuditLog(
      req.user?._id,
      "VARIATION_CREATED",
      `SKU ${variation.sku} created`,
    );

    res.status(201).json({
      success: true,
      message: "Variation created successfully",
      data: variation
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0] || "field";
      return res.status(400).json({
        success: false,
        message: `${duplicateField.toUpperCase()} already exists for this shop`,
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================
   GET ALL VARIATIONS
========================= */
exports.getVariations = async (req, res) => {
  try {
    const { product, model, sku, barcode, isActive, limit = 100, skip = 0, sort = "-createdAt" } = req.query;
    const filter = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (product) filter.product = product;
    if (model) filter.model = model;
    if (sku) filter.sku = { $regex: sku, $options: "i" };
    if (barcode) filter.barcode = { $regex: barcode, $options: "i" };
    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    const [variations, total] = await Promise.all([
      ProductVariation.find(filter)
        .populate("product model shop")
        .sort(sort)
        .skip(Number(skip) || 0)
        .limit(Math.min(200, Number(limit) || 100)),
      ProductVariation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: variations.length,
      total,
      data: variations.map((variation) => sanitizeVariationPricing(variation, req))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================
   GET SINGLE VARIATION
========================= */
exports.getSingleVariation = async (req, res) => {
  try {
    const filter = isSuperAdminGlobal(req)
      ? { _id: req.params.id }
      : { _id: req.params.id, shop: req.shopId };

    const variation = await ProductVariation.findOne(filter)
      .populate("product model shop");

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found"
      });
    }

    res.json({
      success: true,
      data: sanitizeVariationPricing(variation, req)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================
   UPDATE VARIATION
========================= */
exports.updateVariation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const existing = await ProductVariation.findOne({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Variation not found"
      });
    }

    const allowedFields = [
      "sku",
      "barcode",
      "attributes",
      "sellingPrice",
      "costPrice",
      "discount",
      "images",
      "isActive",
    ];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const variation = await ProductVariation.findByIdAndUpdate(
      existing._id,
      updateData,
      { new: true, runValidators: true },
    );

    await Stock.updateOne(
      { shop: req.shopId, variation: variation._id },
      {
        $setOnInsert: {
          shop: req.shopId,
          variation: variation._id,
          quantity: 0,
        },
        $set: {
          sku: variation.sku,
          product: variation.product,
          model: variation.model,
        },
      },
      { upsert: true },
    );

    await pushAuditLog(
      req.user?._id,
      "VARIATION_UPDATED",
      `SKU ${variation.sku} updated`,
    );

    res.json({
      success: true,
      message: "Variation updated successfully",
      data: variation
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error?.keyPattern || {})[0] || "field";
      return res.status(400).json({
        success: false,
        message: `${duplicateField.toUpperCase()} already exists for this shop`,
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================
   DELETE VARIATION
========================= */
exports.deleteVariation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const variation = await ProductVariation.findOne({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found"
      });
    }

    const stock = await Stock.findOne({ shop: req.shopId, variation: variation._id });
    if (stock && Number(stock.quantity || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete variation with available stock. Deactivate instead.",
      });
    }

    const [saleCount, orderCount, purchaseCount] = await Promise.all([
      Sale.countDocuments({
        shop: req.shopId,
        "items.variationId": variation._id,
      }),
      Order.countDocuments({
        shop: req.shopId,
        "items.variationId": variation._id,
      }),
      Purchase.countDocuments({
        shop: req.shopId,
        "items.variation": variation._id,
      }),
    ]);
    const totalUsage =
      Number(saleCount || 0) + Number(orderCount || 0) + Number(purchaseCount || 0);
    if (totalUsage > 0) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete variation because transactions exist. Deactivate instead.",
        usage: {
          saleCount: Number(saleCount || 0),
          orderCount: Number(orderCount || 0),
          purchaseCount: Number(purchaseCount || 0),
        },
      });
    }

    await ProductVariation.findByIdAndDelete(variation._id);
    await Stock.deleteMany({ shop: req.shopId, variation: variation._id });

    await pushAuditLog(
      req.user?._id,
      "VARIATION_DELETED",
      `SKU ${variation.sku} deleted`,
    );

    res.json({
      success: true,
      message: "Variation deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/* =========================
   LOG LABEL PRINT
========================= */
exports.logVariationPrint = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const variation = await ProductVariation.findOne({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found",
      });
    }

    const qty = Math.max(1, Number(req.body?.quantity || 1));
    const size = `${req.body?.size || "50x30"}`;

    await pushAuditLog(
      req.user?._id,
      "LABEL_PRINTED",
      `SKU ${variation.sku} label printed qty=${qty} size=${size}`,
    );

    return res.status(200).json({
      success: true,
      message: "Label print logged",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================
   GET VARIATION USAGE
========================= */
exports.getVariationUsage = async (req, res) => {
  try {
    const variation = await ProductVariation.findOne({
      _id: req.params.id,
      ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
    }).select("_id sku shop");

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found",
      });
    }

    const [saleCount, orderCount] = await Promise.all([
      Sale.countDocuments({
        shop: variation.shop,
        "items.variationId": variation._id,
      }),
      Order.countDocuments({
        shop: variation.shop,
        "items.variationId": variation._id,
      }),
    ]);

    const totalUsage = Number(saleCount || 0) + Number(orderCount || 0);
    return res.status(200).json({
      success: true,
      data: {
        variationId: variation._id,
        sku: variation.sku,
        saleCount: Number(saleCount || 0),
        orderCount: Number(orderCount || 0),
        totalUsage,
        canRegenerateCodes: totalUsage === 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
