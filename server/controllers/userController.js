const User = require("../models/User");
const Shop = require("../models/Shop");
const mongoose = require("mongoose");

const isSuperAdmin = (req) => req.user?.role === "SUPER_ADMIN";

const roleRank = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  MANAGER: 2,
  STAFF: 1,
};

const ensureActiveShop = async (shopId) => {
  if (!shopId) return null;
  if (!mongoose.Types.ObjectId.isValid(shopId)) return null;
  return Shop.findOne({ _id: shopId, isActive: true });
};

const resolveTargetShopForCreate = async (req) => {
  if (isSuperAdmin(req)) {
    // SUPER_ADMIN can create global SUPER_ADMIN (no shop) OR shop-scoped users.
    const selectedShopId =
      req.body?.shop ||
      req.headers["x-shop-id"] ||
      req.query?.shopId ||
      null;
    if (!selectedShopId) return null;
    return ensureActiveShop(selectedShopId);
  }

  // ADMIN/MANAGER must create only in their own shop.
  if (!req.user?.shop) return null;
  return ensureActiveShop(req.user.shop);
};

const canAssignRole = (actorRole, targetRole) => {
  if (!actorRole || !targetRole) return false;
  if (actorRole === "SUPER_ADMIN") return ["ADMIN", "MANAGER", "STAFF"].includes(targetRole);
  if (actorRole === "ADMIN") return ["MANAGER", "STAFF"].includes(targetRole);
  return false;
};


exports.createUser = async (req, res) => {
  try {
    const { email, password, phoneNo, role, shop } = req.body;

    // STAFF kisi ko create nahi karega
    if (req.user.role === "STAFF") {
      return res.status(403).json({
        message: "STAFF cannot create users"
      });
    }

    if (!email || !password || !phoneNo || !role) {
      return res.status(400).json({
        success: false,
        message: "email, password, phoneNo and role are required",
      });
    }

    if (!canAssignRole(req.user.role, role)) {
      return res.status(403).json({
        success: false,
        message: "You cannot create this role",
      });
    }

    if (role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Creating SUPER_ADMIN from app is not allowed",
      });
    }

    let targetShop = await resolveTargetShopForCreate(req);
    if (!targetShop) {
      return res.status(400).json({
        success: false,
        message: "Valid active shop is required to create this user",
      });
    }

    // Non-super users cannot override shop via payload.
    if (!isSuperAdmin(req) && shop && shop.toString() !== req.user.shop?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can create users only in your own shop",
      });
    }

    const user = await User.create({
      email,
      password,
      phoneNo,
      role,
      shop: targetShop?._id,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        _id: user._id,
        email: user.email,
        phoneNo: user.phoneNo,
        role: user.role,
        shop: user.shop || null,
        isActive: user.isActive,
      },
    });

  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User with this email or phone already exists",
      });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "SUPER_ADMIN") {
      const selectedShopId =
        req.headers["x-shop-id"] ||
        req.query?.shopId ||
        req.query?.shop ||
        null;

      if (selectedShopId) {
        if (!mongoose.Types.ObjectId.isValid(selectedShopId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid shop id",
          });
        }

        const shopExists = await Shop.exists({ _id: selectedShopId, isActive: true });
        if (!shopExists) {
          return res.status(404).json({
            success: false,
            message: "Selected shop not found",
          });
        }
        filter = { shop: selectedShopId };
      }
    } else {
      if (!req.user.shop) {
        return res.status(403).json({
          success: false,
          message: "No shop assigned for this user",
        });
      }
      filter = { shop: req.user.shop };
    }

    const users = await User.find(filter)
      .select("-password")
      .populate("shop", "name shopCode");

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const actorRole = req.user.role;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    const target = await User.findById(id).select("+password");
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (actorRole !== "SUPER_ADMIN") {
      if (!req.user.shop || target.shop?.toString() !== req.user.shop?.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can edit users only in your own shop",
        });
      }
    }

    const requestedRole = req.body?.role;
    const targetRole = requestedRole || target.role;

    if (requestedRole !== undefined) {
      if (requestedRole === "SUPER_ADMIN" && target.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Promoting to SUPER_ADMIN is not allowed from app",
        });
      }

      if (!canAssignRole(actorRole, requestedRole)) {
        return res.status(403).json({
          success: false,
          message: "You cannot assign this role",
        });
      }
    }

    if (actorRole !== "SUPER_ADMIN" && roleRank[target.role] >= roleRank[actorRole]) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit same or higher role users",
      });
    }

    const allowedFields = ["email", "phoneNo", "role", "isActive"];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Shop change control
    if (req.body.shop !== undefined) {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({
          success: false,
          message: "Only SUPER_ADMIN can change user shop",
        });
      }

      if (req.body.shop === null || req.body.shop === "") {
        return res.status(400).json({
          success: false,
          message: "User shop cannot be empty",
        });
      } else {
        const shop = await ensureActiveShop(req.body.shop);
        if (!shop) {
          return res.status(400).json({
            success: false,
            message: "Invalid or inactive shop",
          });
        }
        updateData.shop = shop._id;
      }
    }

    if (updateData.shop === null || (!updateData.shop && !target.shop)) {
      return res.status(400).json({
        success: false,
        message: "Users must belong to a valid shop",
      });
    }

    const updated = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password").populate("shop", "name shopCode");

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate email or phone",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};
