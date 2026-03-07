const express = require("express");
const router = express.Router();

const brandController = require("../controllers/brandController");
const { protect, attachShop, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

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
  brandController.getBrands
);

/* =========================
   UPDATE BRAND
========================= */
router.put(
  "/:id",
  updateBrandValidation,
  validate,
  brandController.updateBrand
);

/* =========================
   DELETE BRAND
========================= */
router.delete(
  "/:id",
  updateBrandValidation,
  validate,
  brandController.deleteBrand
);

module.exports = router;
