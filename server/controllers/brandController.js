const Brand = require("../models/Brand");
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
   CREATE BRAND
========================= */
exports.createBrand = async (req, res) => {
  try {
    const { name, description, logo } = req.body;
    console.log("[FLOW][BRAND][CREATE]", {
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
        message: "Brand name is required",
      });
    }

    const duplicate = await Brand.findOne({
      shop: req.shopId,
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists for this shop",
      });
    }

    const brand = await Brand.create({
      name: cleanName,
      description,
      logo,
      shop: req.shopId,
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
        message: "Brand already exists for this shop"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating brand",
      error: error.message
    });
  }
};


/* =========================
   GET ALL BRANDS (SHOP WISE)
========================= */
exports.getBrands = async (req, res) => {
  try {
    const { sort = "-createdAt", search, isActive } = req.query;
    const { limit, skip } = parsePagination(req.query);
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    console.log("[FLOW][BRAND][LIST] request", {
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
    console.log("[FLOW][BRAND][LIST] response", {
      count: brands.length,
      shopId: req.shopId?.toString(),
    });

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
    console.log("[FLOW][BRAND][UPDATE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      brandId: id,
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
        message: "Invalid brand id",
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
        shop: req.shopId,
        name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Brand already exists for this shop",
        });
      }
    }

    const brand = await Brand.findOneAndUpdate(
      { _id: id, shop: req.shopId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand
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
    console.log("[FLOW][BRAND][DELETE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      brandId: id,
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
        message: "Invalid brand id",
      });
    }

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

    const brand = await Brand.findOneAndDelete({
      _id: id,
      shop: req.shopId,
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

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
