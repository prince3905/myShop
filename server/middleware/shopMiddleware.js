const Shop = require("../models/Shop");

/* =========================================
   ATTACH SHOP (MULTI-TENANT SECURITY)
========================================= */
exports.attachShop = async (req, res, next) => {
  try {

    // ===============================
    // 👑 SUPER ADMIN
    // ===============================
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

      req.shop = shop;          // full shop object
      req.shopId = shop._id;    // quick access
      return next();
    }


    // ===============================
    // 👤 NORMAL USER / ADMIN
    // ===============================
    const shop = await Shop.findOne({
      owner: req.user._id,
      isActive: true,
    });

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