const express = require("express");
const router = express.Router();

const productVariationController = require("../controllers/productVariationController");

const { validate } = require("../middleware/validate");
const {
  createVariationValidation,
  updateVariationValidation
} = require("../middleware/productVariationValidation");

/* =========================
   CREATE PRODUCT VARIATION
========================= */
router.post(
  "/",
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
  productVariationController.getVariations
);

/* =========================
   GET SINGLE VARIATION
========================= */
router.get(
  "/:id",
  productVariationController.getSingleVariation
);

/* =========================
   UPDATE VARIATION
========================= */
router.put(
  "/:id",
  updateVariationValidation,
  validate,
  productVariationController.updateVariation
);

/* =========================
   DELETE VARIATION
========================= */
router.delete(
  "/:id",
  productVariationController.deleteVariation
);

module.exports = router;