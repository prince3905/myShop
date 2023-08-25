const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Category = require("../models/categoryModel");

exports.addCategory = async (req, res) => {
  const newCategoryData = req.body;
  newCategoryData.createdAt = new Date();
  const newCategory = new Category(newCategoryData);
  newCategory
    .save()
    .then((savedCategory) => {
      res.status(201).json({
        message: "Category added successfully.",
        Category: savedCategory,
      });
    })
    .catch((err) => {
      console.error("Error saving category:", err);
      res.status(500).json({ error: "Error saving category" });
    });
};

exports.updateCategory = async (req, res) => {
  const categoryId = req.body;
  // console.log(categoryId);
  try {
    const updatedCategoryData = {
      name: req.body.name,
      description: req.body.description,
    };
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      updatedCategoryData,
      {
        new: true,
      }
    );
    if (!updatedCategory) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.status(200).json({
      message: "Category updated successfully.",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Error updating category" });
  }
};

exports.allCategory = async (req, res) => {
  try {
    const category = await Category.find({});
    // console.log(category);
    res.status(200).json(category);
  } catch (err) {
    console.error("Error retrieving category:", err);
    res.status(500).json({ error: "Error retrieving category" });
  }
};

exports.deleteCategory = (req, res) => {
  const { id } = req.params;
  // console.log(req.params)
  Category.findByIdAndDelete(id)
    .then((DeleteCategory) => {
      if (!DeleteCategory) {
        return res.status(404).json({ error: "Category  not found" });
      }

      // console.log("Category  delete:", DeleteCategory);
      res.status(200).json({ message: "Category deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting Category :", err);
      res.status(500).json({ error: "Error deleting Category " });
    });
};
