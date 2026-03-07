const express = require("express");
const router = express.Router();

const productVariationController = require("../controllers/productVariationController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

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
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
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
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getVariations
);

/* =========================
   GET SINGLE VARIATION
========================= */
router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getSingleVariation
);

router.get(
  "/:id/usage",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  productVariationController.getVariationUsage
);

/* =========================
   UPDATE VARIATION
========================= */
router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateVariationValidation,
  validate,
  productVariationController.updateVariation
);

router.post(
  "/:id/print-log",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  productVariationController.logVariationPrint
);

/* =========================
   DELETE VARIATION
========================= */
router.delete(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  productVariationController.deleteVariation
);

module.exports = router;
