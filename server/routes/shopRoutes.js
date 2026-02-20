const express = require("express");
const router = express.Router();

const shop = require("../controllers/shopController");
const auth = require("../middleware/authMiddleware");

/* ================================
   SUPER ADMIN ROUTE (NO attachShop)
================================ */
router.get("/admin/all", auth.protect, shop.getAllShops);

/* ================================
   BELOW ROUTES REQUIRE SHOP CONTEXT
================================ */
router.use(auth.protect);
router.use(auth.attachShop);

router.post("/", shop.createShop);
router.get("/", shop.getMyShops);
router.get("/:id", shop.getShopById);
router.put("/:id", shop.updateShop);
router.delete("/:id", shop.deleteShop);

module.exports = router;