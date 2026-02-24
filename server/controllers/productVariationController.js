const ProductVariation = require("../models/ProductVariation");
const mongoose = require("mongoose");

/* =========================
   CREATE VARIATION
========================= */
exports.createVariation = async (req, res) => {
  try {
    const variation = await ProductVariation.create(req.body);

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
    const { shop, product, model, sku } = req.query;

    let filter = {};

    if (shop) filter.shop = shop;
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
    const variation = await ProductVariation.findById(req.params.id)
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
    const variation = await ProductVariation.findByIdAndUpdate(
      req.params.id,
      req.body,
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
    const variation = await ProductVariation.findByIdAndDelete(req.params.id);

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