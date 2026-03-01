const Category = require("../models/Category");
const Product = require("../models/Product");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

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

    const category = await Category.create({
      name,
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
    const { limit, skip, sort = "-createdAt", search } = req.query;
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

    let categoryQuery = Category.find(query).sort(sort);

    if (limit) {
      categoryQuery = categoryQuery.limit(Number(limit) || 0);
    }

    if (skip) {
      categoryQuery = categoryQuery.skip(Number(skip) || 0);
    }

    const categories = await categoryQuery;
    console.log("[FLOW][CATEGORY][LIST] response", {
      count: categories.length,
      shopId: req.shopId?.toString(),
    });

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
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const allowedFields = ["name", "description", "image", "isActive"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
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
