const ProductModel = require("../models/ProductModel");
const Product = require("../models/Product");

const generateAutoDescription = (name) => {
  return `Best selling ${name} with premium finish and excellent quality.`;
};

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
      description: description || generateAutoDescription(name),
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
      message: "Internal server error"
    });
  }
};

exports.getProductModels = async (req, res) => {
  try {
    const filter = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const { product } = req.query;

    if (product) {
      filter.product = product;
    }

    const models = await ProductModel.find(filter)
      .select("name product isActive createdAt")
      .populate("product", "name")
      .sort("name")
      .lean();

    res.json({
      success: true,
      count: models.length,
      data: models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

exports.updateProductModel = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const { id } = req.params;
    const { name, isActive } = req.body;

    const model = await ProductModel.findOne({
      _id: id,
      shop: req.shopId,
    });

    if (!model) {
      return res.status(404).json({
        success: false,
        message: "Model not found",
      });
    }

    // Check if variations exist for this model before allowing edit/rename
    const ProductVariation = require("../models/ProductVariation");
    const variationCount = await ProductVariation.countDocuments({ model: id, shop: req.shopId });

    if (variationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Is Model (${model.name}) ke sath pehle se ${variationCount} Variation(s) judi hui hain. Edit ya Delete karne se pehle iski sabhi Variations delete karni hongi.`,
      });
    }

    if (name) model.name = name;
    if (isActive !== undefined) model.isActive = isActive;

    await model.save();

    res.json({
      success: true,
      message: "Model updated successfully",
      data: model,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating model",
      error: error.message,
    });
  }
};

exports.deleteProductModel = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const { id } = req.params;

    const model = await ProductModel.findOne({
      _id: id,
      shop: req.shopId,
    });

    if (!model) {
      return res.status(404).json({
        success: false,
        message: "Model not found",
      });
    }

    const ProductVariation = require("../models/ProductVariation");
    const variationCount = await ProductVariation.countDocuments({ model: id, shop: req.shopId });

    if (variationCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Is Model (${model.name}) ke sath pehle se ${variationCount} Variation(s) judi hui hain. Edit ya Delete karne se pehle iski sabhi Variations delete karni hongi.`,
      });
    }

    await ProductModel.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Model deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting model",
      error: error.message,
    });
  }
};
