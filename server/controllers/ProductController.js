const Product = require("../models/Product");
const slugify = require("slugify");
const ProductVariation = require("../models/ProductVariation");
const ProductModel = require("../models/ProductModel");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

/* =========================
   CREATE PRODUCT
========================= */
exports.createProduct = async (req, res) => {
  try {
    const { name, category, brand, description, images } = req.body;
    console.log("[FLOW][PRODUCT][CREATE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      name,
      category,
      brand,
    });

    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const product = await Product.create({
      name,
      slug,
      category,
      brand,
      description,
      images,
      shop: req.shopId,
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
    const { limit, skip, sort = "-createdAt", search } = req.query;
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    console.log("[FLOW][PRODUCT][LIST] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      query: { limit, skip, sort, search },
    });

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let productQuery = Product.find(query)
      .sort(sort)
      .populate("brand", "name")
      .populate("category", "name")
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      });

    if (limit) {
      productQuery = productQuery.limit(Number(limit) || 0);
    }

    if (skip) {
      productQuery = productQuery.skip(Number(skip) || 0);
    }

    const products = await productQuery;
    console.log("[FLOW][PRODUCT][LIST] response", {
      count: products.length,
      shopId: req.shopId?.toString(),
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
    console.log("[FLOW][PRODUCT][GET_ONE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      productId: req.params.id,
    });
    const filter = isSuperAdminGlobal(req)
      ? { _id: req.params.id }
      : { _id: req.params.id, shop: req.shopId };

    const product = await Product.findOne(filter)
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
    console.log("[FLOW][PRODUCT][UPDATE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      productId: id,
    });
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const allowedFields = ["name", "category", "brand", "description", "images", "isActive"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, shop: req.shopId },
      updateData,
      {
      new: true,
      runValidators: true,
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
    console.log("[FLOW][PRODUCT][DELETE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      productId: id,
    });
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const product = await Product.findOne({
      _id: id,
      shop: req.shopId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Delete variations
    await ProductVariation.deleteMany({ product: id, shop: req.shopId });

    // Delete models
    await ProductModel.deleteMany({ product: id, shop: req.shopId });

    // Delete product
    await Product.findOneAndDelete({ _id: id, shop: req.shopId });

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
