const express = require("express");
const router = express.Router();

const productController = require("../controllers/ProductController");
const { protect, attachShop, authorizePermission, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

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
  authorizeFeature("inventory.products"),
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
  authorizeFeature("inventory.products"),
  productController.getProducts
);

router.get(
  "/pos-search",
  authorizeFeature("sales.pos"),
  productController.searchProductsForPos
);

/* =========================
   GET SINGLE PRODUCT
========================= */
router.get(
  "/:id",
  authorizeFeature("inventory.product_details"),
  updateProductValidation,
  validate,
  productController.getProductById
);

/* =========================
   UPDATE PRODUCT
========================= */
router.put(
  "/:id",
  authorizeFeature("inventory.products"),
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
  authorizeFeature("inventory.products"),
  authorizePermission("MANAGE_PRODUCTS"),
  updateProductValidation,
  validate,
  productController.deleteProduct
);

router.patch(
  "/:id/restore",
  authorizeFeature("inventory.products"),
  authorizePermission("MANAGE_PRODUCTS"),
  updateProductValidation,
  validate,
  productController.restoreProduct
);

module.exports = router;
