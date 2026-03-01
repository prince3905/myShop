const express = require("express");
const router = express.Router();

const productModelController = require("../controllers/productModelController");
const { createProductModelValidation } = require("../middleware/productModelValidation");
const { validate } = require("../middleware/validate");
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  createProductModelValidation,
  validate,
  productModelController.createProductModel
);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), productModelController.getProductModels);

module.exports = router;
