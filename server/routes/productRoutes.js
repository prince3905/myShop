const express = require("express");
const router = express.Router();

const productController = require("../controllers/ProductController");
const { protect, attachShop, authorizePermission, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createProductValidation,
  updateProductValidation
} = require("../middleware/productValidation");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

/* =========================
   CREATE PRODUCT
========================= */
router.post(
  "/",
  authorizePermission("MANAGE_PRODUCTS"),
  createProductValidation,
  validate,
  productController.createProduct
);

/* =========================
   GET ALL PRODUCTS
   Example: /api/products?shop=SHOP_ID
========================= */
router.get(
  "/",
  productController.getProducts
);

router.get(
  "/pos-search",
  productController.searchProductsForPos
);

/* =========================
   GET SINGLE PRODUCT
========================= */
router.get(
  "/:id",
  updateProductValidation,
  validate,
  productController.getProductById
);

/* =========================
   UPDATE PRODUCT
========================= */
router.put(
  "/:id",
  authorizePermission("MANAGE_PRODUCTS"),
  updateProductValidation,
  validate,
  productController.updateProduct
);

/* =========================
   DELETE PRODUCT
========================= */
router.delete(
  "/:id",
  authorizePermission("MANAGE_PRODUCTS"),
  updateProductValidation,
  validate,
  productController.deleteProduct
);

router.patch(
  "/:id/restore",
  authorizePermission("MANAGE_PRODUCTS"),
  updateProductValidation,
  validate,
  productController.restoreProduct
);

module.exports = router;
