const ProductModel = require("../models/ProductModel");
const Product = require("../models/Product");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

exports.createProductModel = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const { product, name, description, images, isActive } = req.body;
    const productExists = await Product.findOne({ _id: product, shop: req.shopId });

    if (!productExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid product for selected shop",
      });
    }

    const productModel = await ProductModel.create({
      product,
      name,
      description,
      images,
      isActive,
      shop: req.shopId,
    });

    res.status(201).json({
      success: true,
      data: productModel
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getProductModels = async (req, res) => {
  try {
    const filter = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const models = await ProductModel.find(filter)
      .populate("shop", "name")
      .populate("product", "name");

    res.json({
      success: true,
      count: models.length,
      data: models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
