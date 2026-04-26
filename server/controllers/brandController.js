const Brand = require("../models/Brand");
const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");

const generateAutoDescription = (name) => {
  const adj = ["trusted", "popular", "premium", "leading", "quality"];
  const randomAdj = adj[Math.floor(Math.random() * adj.length)];
  return `${randomAdj.charAt(0).toUpperCase() + randomAdj.slice(1)} ${name} brand known for quality and reliability.`;
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
   CREATE BRAND
========================= */
exports.createBrand = async (req, res) => {
  try {
    const { name, description, logo, shops } = req.body;

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
        message: "Brand name is required",
      });
    }

    // Default shops - agar nahi diya toh sirf creator ko access
    const brandShops = shops && shops.length > 0 ? shops : [req.shopId];

    // Check duplicate in creator's shop only
    const duplicate = await Brand.findOne({
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      ownerShop: req.shopId,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists in your shop",
      });
    }

    const brand = await Brand.create({
      name: cleanName,
      description: description || generateAutoDescription(cleanName),
      logo,
      shops: brandShops,
      ownerShop: req.shopId,
    });

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating brand",
      error: "Internal server error"
    });
  }
};


/* =========================
   GET ALL BRANDS (SHOP WISE)
======================= */
exports.getBrands = async (req, res) => {
  try {
    const { sort = "-createdAt", search, isActive } = req.query;
    const { limit, skip } = parsePagination(req.query);
    
    // Brand dikhe jo is shop ko access hai
    const query = { shops: { $in: [req.shopId] } };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
      query.isActive = `${isActive}` === "true";
    }

    let brandQuery = Brand.find(query).sort(sort);

    if (limit) {
      brandQuery = brandQuery.limit(Number(limit) || 0);
    }

    if (skip) {
      brandQuery = brandQuery.skip(Number(skip) || 0);
    }

    const [brands, totalItems] = await Promise.all([
      brandQuery,
      Brand.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: brands.length,
      totalItems,
      data: brands
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching brands"
    });
  }
};


/* =========================
   UPDATE BRAND
========================= */
exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand id",
      });
    }

    // Sirf owner edit kar sakta hai
    const brand = await Brand.findOne({
      _id: id,
      ownerShop: req.shopId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found or you don't have permission to edit"
      });
    }

    const allowedFields = ["name", "description", "logo", "isActive"];
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
          message: "Brand name is required",
        });
      }
      updateData.name = cleanName;

      const duplicate = await Brand.findOne({
        _id: { $ne: id },
        name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        ownerShop: req.shopId,
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Brand already exists in your shop",
        });
      }
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: updatedBrand
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating brand"
    });
  }
};


/* =========================
   DELETE BRAND
========================= */
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid brand id",
      });
    }

    // Sirf owner delete kar sakta hai
    const brand = await Brand.findOne({
      _id: id,
      ownerShop: req.shopId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found or you don't have permission to delete"
      });
    }

    // Check if used in products
    const productUsingBrand = await Product.findOne({
      brand: id,
      shop: req.shopId,
    });

    if (productUsingBrand) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete brand. It is used in products."
      });
    }

    // Check if mapped in categories
    const categoryUsingBrand = await Category.findOne({
      shop: req.shopId,
      brands: id,
    });

    if (categoryUsingBrand) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete brand. It is mapped inside categories.",
      });
    }

    await brand.deleteOne();

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting brand"
    });
  }
};