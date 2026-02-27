const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Shop = require("../models/Shop");
const rolePermissions = require("../config/permissions");



/* =========================================
   PROTECT (JWT VERIFY)
========================================= */
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user; // ✅ attach user
    next();

  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};


/* =========================================
   ROLE BASED ACCESS
========================================= */
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied (role)",
      });
    }
    next();
  };
};


/* =========================================
   PERMISSION BASED ACCESS
========================================= */
exports.authorizePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const permissions = rolePermissions[userRole];

    if (!permissions || !permissions.includes(permission)) {
      return res.status(403).json({
        message: "You do not have permission",
      });
    }

    next();
  };
};


/* =========================================
   ATTACH SHOP (MULTI-TENANT SECURITY)
========================================= */
exports.attachShop = async (req, res, next) => {
  try {

    // SUPER ADMIN
    if (req.user.role === "SUPER_ADMIN") {

      const selectedShopId = req.headers["x-shop-id"];

      if (!selectedShopId) {
        return res.status(400).json({
          message: "Super Admin must select a shop (x-shop-id header missing)",
        });
      }

      const shop = await Shop.findById(selectedShopId);

      if (!shop) {
        return res.status(404).json({
          message: "Selected shop not found",
        });
      }

      req.shop = shop;
      req.shopId = shop._id;
      return next();
    }

    // NORMAL USER
    let shop = null;

    if (req.user.shop) {
      shop = await Shop.findOne({
        _id: req.user.shop,
        isActive: true,
      });
    }

    // Backward compatibility for old users where shop is not set on user
    if (!shop) {
      shop = await Shop.findOne({
        owner: req.user._id,
        isActive: true,
      });
    }

    if (!shop) {
      return res.status(403).json({
        message: "No active shop associated with this user",
      });
    }

    req.shop = shop;
    req.shopId = shop._id;

    next();

  } catch (error) {
    console.error("Attach Shop Error:", error);
    return res.status(500).json({
      message: "Server error while attaching shop",
    });
  }
};
