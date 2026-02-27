const express = require("express");
const router = express.Router();

const productController = require("../controllers/ProductController");
const { protect, attachShop } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createProductValidation,
  updateProductValidation
} = require("../middleware/productValidation");

router.use(protect);
router.use(attachShop);

/* =========================
   CREATE PRODUCT
========================= */
router.post(
  "/",
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
  updateProductValidation,
  validate,
  productController.updateProduct
);

/* =========================
   DELETE PRODUCT
========================= */
router.delete(
  "/:id",
  updateProductValidation,
  validate,
  productController.deleteProduct
);

module.exports = router;
