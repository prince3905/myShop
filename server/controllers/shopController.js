const logger = require("../utils/logger");
const Shop = require("../models/Shop");

/* =========================================
   ROLE BASED FILTER
========================================= */
const getShopFilter = (req) => {
  if (req.user.role === "SUPER_ADMIN") {
    return {}; // SUPER_ADMIN sab dekh sakta hai
  }

  return { owner: req.user._id }; // Normal user sirf apni shop
};

/* =========================================
   CREATE SHOP
========================================= */
exports.createShop = async (req, res) => {
  try {
    const { name, shopCode, contactNumber, email, address, shopType } =
      req.body;

    /* Basic validation */
    if (!name || !shopCode) {
      return res.status(400).json({
        success: false,
        message: "Shop name and shopCode are required",
      });
    }

    /* Check duplicate shopCode */
    const existingShop = await Shop.findOne({
      shopCode: shopCode.toUpperCase(),
    });

    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: "Shop code already exists",
      });
    }

    /* Create shop */
    const shop = await Shop.create({
      name,
      shopCode: shopCode.toUpperCase(),
      owner: req.user._id, // 🔐 secure
      contactNumber,
      email,
      address,
      shopType,
    });

    return res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: shop,
    });
  } catch (error) {
    logger.error("Create Shop Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================================
   GET MY SHOPS (PAGINATED)
========================================= */
exports.getMyShops = async (req, res) => {
  try {
    const filter = getShopFilter(req);

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [shops, totalShops] = await Promise.all([
      Shop.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Shop.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: shops.length,
      totalShops,
      page,
      limit,
      totalPages: Math.ceil(totalShops / limit),
      data: shops,
    });
  } catch (error) {
    logger.error("Get Shops Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================================
   GET SINGLE SHOP
========================================= */
exports.getShopById = async (req, res) => {
  try {
    const filter = getShopFilter(req);

    const shop = await Shop.findOne({
      _id: req.params.id,
      ...filter,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shop,
    });
  } catch (error) {
    logger.error("Get Shop Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================================
   UPDATE SHOP
========================================= */
exports.updateShop = async (req, res) => {
  const allowedFields = [
    "name",
    "shopCode",
    "contactNumber",
    "email",
    "address",
    "shopType",
  ];

  const updateData = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === "shopCode") {
        updateData[field] = `${req.body[field]}`.trim().toUpperCase();
      } else {
        updateData[field] = req.body[field];
      }
    }
  });

  try {
    if (updateData.shopCode) {
      const existing = await Shop.findOne({ shopCode: updateData.shopCode, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `Shop code "${updateData.shopCode}" already in use` });
      }
    }
    const filter = getShopFilter(req);
    const updatedShop = await Shop.findOneAndUpdate(
      {
        _id: req.params.id,
        ...filter,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedShop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shop updated successfully",
      data: updatedShop,
    });
  } catch (error) {
    logger.error("Update Shop Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* =========================================
   DELETE SHOP
========================================= */
exports.deleteShop = async (req, res) => {
  try {
    const filter = getShopFilter(req);
    const shop = await Shop.findOneAndDelete({
      _id: req.params.id,
      ...filter,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or unauthorized",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shop deleted successfully",
    });
  } catch (error) {
    logger.error("Delete Shop Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


/* =========================================
   GET ALL SHOPS (PAGINATED - SUPER ADMIN)
========================================= */
exports.getAllShops = async (req, res) => {
  try {

    if (req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can view all shops"
      });
    }

    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === "true" || req.query.isActive === "1";
    }
    if (req.query.isVerified !== undefined) {
      filter.isVerified = req.query.isVerified === "true" || req.query.isVerified === "1";
    }
    if (req.query.shopType) {
      filter.shopType = req.query.shopType;
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { shopCode: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [shops, totalShops] = await Promise.all([
      Shop.find(filter)
        .select("name shopCode isActive isVerified shopType contactNumber email createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Shop.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: shops.length,
      totalShops,
      page,
      limit,
      totalPages: Math.ceil(totalShops / limit),
      data: shops,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.getPushTargetShops = async (req, res) => {
  try {
    const shops = await Shop.find({ isActive: true }).select("name shopCode isActive").sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: shops.length,
      data: shops,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
