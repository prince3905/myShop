const express = require("express");
const router = express.Router();

const shop = require("../controllers/shopController");
const auth = require("../middleware/authMiddleware");

/* ================================
   SUPER ADMIN ROUTE (NO attachShop)
================================ */
router.get("/admin/all", auth.protect, shop.getAllShops);
router.get(
  "/push-targets",
  auth.protect,
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  auth.authorizeFeature("factory.push_to_shop"),
  shop.getPushTargetShops,
);

/* ================================
   BELOW ROUTES REQUIRE SHOP CONTEXT
================================ */
router.use(auth.protect);
router.use(auth.attachShop);

router.get(
  "/",
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  shop.getMyShops,
);
router.get(
  "/:id",
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  shop.getShopById,
);
router.post("/", auth.authorizeRoles("SUPER_ADMIN"), shop.createShop);
router.put("/:id", auth.authorizeRoles("SUPER_ADMIN"), shop.updateShop);
router.delete("/:id", auth.authorizeRoles("SUPER_ADMIN"), shop.deleteShop);

module.exports = router;
