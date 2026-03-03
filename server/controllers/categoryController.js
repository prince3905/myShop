const Category = require("../models/Category");
const Product = require("../models/Product");
const mongoose = require("mongoose");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

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
    const { name, description, image } = req.body;
    console.log("[FLOW][CATEGORY][CREATE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      name,
    });

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

    const duplicate = await Category.findOne({
      shop: req.shopId,
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Category already exists for this shop",
      });
    }

    const category = await Category.create({
      name: cleanName,
      description,
      image,
      shop: req.shopId,
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
    const { sort = "-createdAt", search, isActive } = req.query;
    const { limit, skip } = parsePagination(req.query);
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    console.log("[FLOW][CATEGORY][LIST] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      query: { limit, skip, sort, search },
    });

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
      query.isActive = `${isActive}` === "true";
    }

    let categoryQuery = Category.find(query).sort(sort);

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
    console.log("[FLOW][CATEGORY][LIST] response", {
      count: categories.length,
      shopId: req.shopId?.toString(),
    });

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
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const allowedFields = ["name", "description", "image", "isActive"];
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
        shop: req.shopId,
        name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Category already exists for this shop",
        });
      }
    }

    const category = await Category.findOneAndUpdate(
      { _id: id, shop: req.shopId },
      updateData,
      { new: true, runValidators: true }
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
    console.log("[FLOW][CATEGORY][DELETE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      categoryId: id,
    });
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category id",
      });
    }

    const productUsingCategory = await Product.findOne({
      category: id,
      shop: req.shopId,
    });

    if (productUsingCategory) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category. It is used in products."
      });
    }

    const category = await Category.findOneAndDelete({
      _id: id,
      shop: req.shopId,
    });

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
