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
    console.log("[FLOW][MW][PROTECT] tokenPresent", true);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[FLOW][MW][PROTECT] decoded", {
      id: decoded?.id,
      role: decoded?.role,
      shop: decoded?.shop,
    });

    const user = await User.findById(decoded.id);
    console.log("[FLOW][MW][PROTECT] userLookup", {
      found: !!user,
      userId: user?._id?.toString(),
      role: user?.role,
      shop: user?.shop?.toString(),
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Session validation for tokens carrying sid
    if (decoded?.sid) {
      const hasSession = (user.sessions || []).some((s) => s.sid === decoded.sid);

      // Migration-safe fallback:
      // if old user document has no sessions but token has sid, bootstrap it once.
      if (!hasSession && (!user.sessions || user.sessions.length === 0)) {
        await User.findByIdAndUpdate(user._id, {
          $push: {
            sessions: {
              sid: decoded.sid,
              userAgent: req.headers["user-agent"] || "Unknown",
              ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
              createdAt: new Date(),
              lastSeenAt: new Date(),
            },
          },
        });
      } else if (!hasSession) {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }

      // Atomic lastSeen update avoids version conflicts from parallel requests
      await User.updateOne(
        { _id: user._id, "sessions.sid": decoded.sid },
        { $set: { "sessions.$.lastSeenAt": new Date() } }
      );
    }

    req.user = user; // ✅ attach user
    next();

  } catch (error) {
    console.error("[FLOW][MW][PROTECT] error", error?.message);
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
    console.log("[FLOW][MW][ATTACH_SHOP] start", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      headerShopId: req.headers["x-shop-id"] || null,
      userShop: req.user?.shop?.toString?.() || null,
    });

    // SUPER ADMIN
    if (req.user.role === "SUPER_ADMIN") {

      const selectedShopId =
        req.headers["x-shop-id"] ||
        req.query?.shopId ||
        req.body?.shop ||
        null;

      if (!selectedShopId) {
        req.shop = null;
        req.shopId = null;
        console.log("[FLOW][MW][ATTACH_SHOP] superAdminGlobal");
        return next();
      }

      const shop = await Shop.findById(selectedShopId);

      if (!shop) {
        return res.status(404).json({
          message: "Selected shop not found",
        });
      }

      req.shop = shop;
      req.shopId = shop._id;
      console.log("[FLOW][MW][ATTACH_SHOP] superAdminResolved", {
        shopId: req.shopId.toString(),
      });
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
    console.log("[FLOW][MW][ATTACH_SHOP] normalResolved", {
      shopId: req.shopId.toString(),
      shopCode: req.shop?.shopCode,
    });

    next();

  } catch (error) {
    console.error("Attach Shop Error:", error);
    return res.status(500).json({
      message: "Server error while attaching shop",
    });
  }
};
