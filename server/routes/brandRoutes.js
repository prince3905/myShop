const express = require("express");
const router = express.Router();

const brandController = require("../controllers/brandController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createBrandValidation,
  updateBrandValidation
} = require("../middleware/brandValidation");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

/* =========================
   CREATE BRAND
========================= */
router.post(
  "/",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  createBrandValidation,
  validate,
  brandController.createBrand
);

/* =========================
   GET ALL BRANDS (SHOP WISE)
   Example: /api/brands?shop=SHOP_ID
========================= */
router.get(
  "/",
  authorizeFeature("inventory.products"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  brandController.getBrands
);

/* =========================
   UPDATE BRAND
========================= */
router.put(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  updateBrandValidation,
  validate,
  brandController.updateBrand
);

/* =========================
   DELETE BRAND
========================= */
router.delete(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  updateBrandValidation,
  validate,
  brandController.deleteBrand
);

module.exports = router;
