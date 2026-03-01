const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

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
      quantity,
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
      quantity,
      discount,
      images,
      isActive,
      shop: req.shopId,
    });

    res.status(201).json({
      success: true,
      message: "Variation created successfully",
      data: variation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/* =========================
   GET ALL VARIATIONS
========================= */
exports.getVariations = async (req, res) => {
  try {
    const { product, model, sku } = req.query;
    const filter = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    if (product) filter.product = product;
    if (model) filter.model = model;
    if (sku) filter.sku = { $regex: sku, $options: "i" };

    const variations = await ProductVariation.find(filter)
      .populate("product model shop")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: variations.length,
      data: variations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
      data: variation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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

    const allowedFields = [
      "sku",
      "barcode",
      "attributes",
      "sellingPrice",
      "costPrice",
      "quantity",
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

    const variation = await ProductVariation.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found"
      });
    }

    res.json({
      success: true,
      message: "Variation updated successfully",
      data: variation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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

    const variation = await ProductVariation.findOneAndDelete({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: "Variation not found"
      });
    }

    res.json({
      success: true,
      message: "Variation deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
