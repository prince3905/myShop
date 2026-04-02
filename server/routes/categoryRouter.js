const express = require("express");
const router = express.Router();

const categoryController = require("../controllers/categoryController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const { validate } = require("../middleware/validate");
const {
  createCategoryValidation,
  updateCategoryValidation
} = require("../middleware/categoryValidation");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

/* =========================
   CREATE CATEGORY
========================= */
router.post(
  "/",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
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
  authorizeFeature("inventory.products"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  categoryController.getCategories
);

/* =========================
   UPDATE CATEGORY
========================= */
router.put(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  updateCategoryValidation,
  validate,
  categoryController.updateCategory
);

/* =========================
   DELETE CATEGORY
========================= */
router.delete(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  updateCategoryValidation,
  validate,
  categoryController.deleteCategory
);

module.exports = router;
