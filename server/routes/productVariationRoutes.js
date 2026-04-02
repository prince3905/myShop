const express = require("express");
const router = express.Router();

const productVariationController = require("../controllers/productVariationController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createVariationValidation,
  updateVariationValidation
} = require("../middleware/productVariationValidation");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

/* =========================
   CREATE PRODUCT VARIATION
========================= */
router.post(
  "/",
  authorizeFeature("inventory.product_details.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  createVariationValidation,
  validate,
  productVariationController.createVariation
);

/* =========================
   GET ALL VARIATIONS
   Example:
   /api/variations?shop=SHOP_ID
   /api/variations?shop=SHOP_ID&product=PRODUCT_ID
   /api/variations?shop=SHOP_ID&model=MODEL_ID
========================= */
router.get(
  "/",
  authorizeFeature("inventory.products"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getVariations
);

/* =========================
   GET SINGLE VARIATION
========================= */
router.get(
  "/:id",
  authorizeFeature("inventory.product_details"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getSingleVariation
);

router.get(
  "/:id/usage",
  authorizeFeature("inventory.product_details"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getVariationUsage
);

/* =========================
   UPDATE VARIATION
========================= */
router.put(
  "/:id",
  authorizeFeature("inventory.product_details.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  updateVariationValidation,
  validate,
  productVariationController.updateVariation
);

router.post(
  "/:id/print-log",
  authorizeFeature("inventory.product_details.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.logVariationPrint
);

/* =========================
   DELETE VARIATION
========================= */
router.delete(
  "/:id",
  authorizeFeature("inventory.product_details.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.deleteVariation
);

module.exports = router;
