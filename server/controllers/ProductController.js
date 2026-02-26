const Product = require("../models/Product");
const slugify = require("slugify");
const ProductVariation = require("../models/ProductVariation");
const ProductModel = require("../models/ProductModel");

/* =========================
   CREATE PRODUCT
========================= */
exports.createProduct = async (req, res) => {
  try {
    const { name, category, brand, description, images, shop } = req.body;
    const slug = slugify(name, { lower: true, strict: true });

    const product = await Product.create({
      name,
      slug,
      category,
      brand,
      description,
      images,
      shop,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product already exists for this shop",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

/* =========================
   GET ALL PRODUCTS (SHOP WISE)
========================= */
exports.getProducts = async (req, res) => {
  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required",
      });
    }

    const products = await Product.find({ shop })
      .populate("brand", "name")
      .populate("category", "name")
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      });

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
    });
  }
};

/* =========================
   GET SINGLE PRODUCT
========================= */
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("brand", "name")
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
    });
  }
};

/* =========================
   UPDATE PRODUCT
========================= */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
    });
  }
};

/* =========================
   DELETE PRODUCT
========================= */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete variations
    await ProductVariation.deleteMany({ product: id });

    // Delete models
    await ProductModel.deleteMany({ product: id });

    // Delete product
    await Product.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Product and all related data deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting product",
    });
  }
};
