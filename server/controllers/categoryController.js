const Category = require("../models/Category");
const Product = require("../models/Product");
const Brand = require("../models/Brand");
const mongoose = require("mongoose");

const generateAutoDescription = (name) => {
  const adj = ["wide range of", "premium", "quality", "durable", "popular"];
  const randomAdj = adj[Math.floor(Math.random() * adj.length)];
  return `${randomAdj.charAt(0).toUpperCase() + randomAdj.slice(1)} ${name} collection for every need. Browse our best selection.`;
};

const normalizeName = (name = "") => name.trim().replace(/\s+/g, " ");

const parsePagination = (query) => {
  const limit = Number(query?.limit || 0);
  const skip = Number(query?.skip || 0);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 0,
    skip: Number.isFinite(skip) && skip > 0 ? skip : 0,
  };
};

/* =========================
   CREATE CATEGORY
========================= */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, image, icon, brands = [], shops } = req.body;

    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const cleanName = normalizeName(name);
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const categoryShops = shops && shops.length > 0 ? shops : [req.shopId];

    const duplicate = await Category.findOne({
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      ownerShop: req.shopId,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Category already exists in your shop",
      });
    }

    const normalizedBrandIds = Array.isArray(brands)
      ? [...new Set(brands.map((id) => `${id || ""}`.trim()).filter(Boolean))]
      : [];

    if (normalizedBrandIds.length) {
      const validBrands = await Brand.countDocuments({
        _id: { $in: normalizedBrandIds },
        isDeleted: { $ne: true }
      });

      if (validBrands !== normalizedBrandIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected brands are invalid",
        });
      }
    }

    const category = await Category.create({
      name: cleanName,
      description: description || generateAutoDescription(cleanName),
      image,
      icon: icon || "folder",
      brands: normalizedBrandIds,
      shops: categoryShops,
      ownerShop: req.shopId,
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
        message: "Category already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating category"
    });
  }
};


/* =========================
   GET ALL CATEGORIES (ALL)
======================= */
exports.getCategories = async (req, res) => {
  try {
    const { sort = "-createdAt", search, isActive } = req.query;
    const { limit, skip } = parsePagination(req.query);
    
    // Show ALL categories - global + all shops
    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
      query.isActive = `${isActive}` === "true";
    }

    let categoryQuery = Category.find(query).populate("brands", "name").sort(sort);

    if (limit) {
      categoryQuery = categoryQuery.limit(Number(limit) || 0);
    }

    if (skip) {
      categoryQuery = categoryQuery.skip(Number(skip) || 0);
    }

    const [categories, totalItems] = await Promise.all([
      categoryQuery,
      Category.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: categories.length,
      totalItems,
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const category = await Category.findOne({
      _id: id,
      ownerShop: req.shopId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or you don't have permission to edit",
      });
    }

    const allowedFields = ["name", "description", "image", "icon", "isActive", "brands"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.name !== undefined) {
      const cleanName = normalizeName(updateData.name);
      if (!cleanName) {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }
      updateData.name = cleanName;

      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        ownerShop: req.shopId,
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Category already exists in your shop",
        });
      }
    }

    if (updateData.brands !== undefined) {
      const normalizedBrandIds = Array.isArray(updateData.brands)
        ? [...new Set(updateData.brands.map((brandId) => `${brandId || ""}`.trim()).filter(Boolean))]
        : [];

      if (normalizedBrandIds.length) {
        const validBrands = await Brand.countDocuments({
          _id: { $in: normalizedBrandIds },
          isDeleted: { $ne: true }
        });

        if (validBrands !== normalizedBrandIds.length) {
          return res.status(400).json({
            success: false,
            message: "One or more selected brands are invalid",
          });
        }
      }

      updateData.brands = normalizedBrandIds;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (updateData.icon !== undefined) {
      await Product.updateMany(
        { category: id },
        { $set: { icon: updateData.icon } }
      );
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: updatedCategory
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const category = await Category.findOne({
      _id: id,
      ownerShop: req.shopId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found or you don't have permission to delete",
      });
    }

    const productUsingCategory = await Product.findOne({
      category: id,
      shop: req.shopId,
    });

    if (productUsingCategory) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category. It is used in products.",
      });
    }

    await category.deleteOne();

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