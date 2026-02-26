const Category = require("../models/category");
const Product = require("../models/Product");

/* =========================
   CREATE CATEGORY
========================= */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image, shop } = req.body;

    const category = await Category.create({
      name,
      description,
      image,
      shop
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Category already exists for this shop"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating category"
    });
  }
};


/* =========================
   GET ALL CATEGORIES
========================= */
exports.getCategories = async (req, res) => {
  try {
    const { shop } = req.query;

    const categories = await Category.find({ shop });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories"
    });
  }
};


/* =========================
   UPDATE CATEGORY
========================= */
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating category"
    });
  }
};


/* =========================
   DELETE CATEGORY
========================= */
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const productUsingCategory = await Product.findOne({ category: id });

    if (productUsingCategory) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category. It is used in products."
      });
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting category"
    });
  }
};