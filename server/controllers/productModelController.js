const ProductModel = require("../models/ProductModel");

exports.createProductModel = async (req, res) => {
  try {
    const productModel = await ProductModel.create(req.body);

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
    const models = await ProductModel.find()
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