const express = require("express");
const router = express.Router();

const productVariationController = require("../controllers/productVariationController");
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createVariationValidation,
  updateVariationValidation
} = require("../middleware/productVariationValidation");

router.use(protect);
router.use(attachShop);

/* =========================
   CREATE PRODUCT VARIATION
========================= */
router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
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

/* =========================
   UPDATE VARIATION
========================= */
router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  updateVariationValidation,
  validate,
  productVariationController.updateVariation
);

/* =========================
   DELETE VARIATION
========================= */
router.delete(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  productVariationController.deleteVariation
);

module.exports = router;
