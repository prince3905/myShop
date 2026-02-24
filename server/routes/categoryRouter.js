const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");

const { validate } = require("../middleware/validate");
const {
  createCategoryValidation,
  updateCategoryValidation
} = require("../middleware/categoryValidation");

/* =========================
   CREATE CATEGORY
========================= */
router.post(
  "/",
  createCategoryValidation,
  validate,
  categoryController.createCategory
);

/* =========================
   GET ALL CATEGORIES (SHOP WISE)
   Example: /api/categories?shop=SHOP_ID
========================= */
router.get(
  "/",
  categoryController.getCategories
);

/* =========================
   UPDATE CATEGORY
========================= */
router.put(
  "/:id",
  updateCategoryValidation,
  validate,
  categoryController.updateCategory
);

/* =========================
   DELETE CATEGORY
========================= */
router.delete(
  "/:id",
  updateCategoryValidation,
  validate,
  categoryController.deleteCategory
);

module.exports = router;