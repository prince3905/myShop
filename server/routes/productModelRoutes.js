const express = require("express");
const router = express.Router();

const productModelController = require("../controllers/productModelController");
const { createProductModelValidation } = require("../middleware/productModelValidation");
const { validate } = require("../middleware/validate");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.post(
  "/",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  createProductModelValidation,
  validate,
  productModelController.createProductModel
);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("inventory.products"), productModelController.getProductModels);

router.put(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  productModelController.updateProductModel
);

router.delete(
  "/:id",
  authorizeFeature("inventory.products.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  productModelController.deleteProductModel
);

module.exports = router;
