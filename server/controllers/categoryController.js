const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Category = require("../models/categoryModel");
const Brand = require('../models/brandModel');

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


exports.updateOrCreateCategory = async (req, res) => {
  const categoryName = req.body.name;
  const description = req.body.description;
  const brandIds = req.body.brands;

  try {
    // Check if the category with the same name already exists
    let existingCategory = await Category.findOne({ name: categoryName });

    if (existingCategory) {
      // If the category exists, update its properties including the brands
      existingCategory.description = description;

      // Filter out any duplicate brand IDs before merging
      const uniqueBrandIds = brandIds.filter((brandId) => !existingCategory.brands.includes(brandId));
      existingCategory.brands = [...existingCategory.brands, ...uniqueBrandIds];

      const updatedCategory = await existingCategory.save();

      return res.status(200).json({
        message: 'Category updated successfully.',
        category: updatedCategory,
      });
    } else {
      // If the category doesn't exist, create a new one
      const newCategory = new Category({
        name: categoryName,
        description: description,
        brands: brandIds,
      });

      const savedCategory = await newCategory.save();

      return res.status(201).json({
        message: 'Category added successfully.',
        category: savedCategory,
      });
    }
  } catch (error) {
    console.error('Error updating/creating category:', error);
    res.status(500).json({ error: 'Error updating/creating category' });
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

exports.getBrandsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    
    // Find the category by ID and populate the brands field to get brand details
    const category = await Category.findById(categoryId).populate('brands');

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const responseObj = {
      category: {
        _id: category._id,
        name: category.name,
        description: category.description,
      },
      brands: category.brands,
    };

    res.status(200).json(responseObj);
  } catch (error) {
    console.error('Error fetching brands by category:', error);
    res.status(500).json({ error: 'Error fetching brands by category' });
  }
};

exports.searchCategoryNameSuggestions = async (req, res) => {
  try {
    // console.log(req.query.term)
    const searchTerm = req.query.term;
    const suggestions = await Category.find({
      name: { $regex: searchTerm, $options: 'i' },
    }).limit(10);

    res.status(200).json(suggestions.map((category) => category.name));
  } catch (err) {
    console.error('Error searching category name suggestions:', err);
    res.status(500).json({ error: 'Error searching category name suggestions' });
  }
};
