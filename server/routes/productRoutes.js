const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const { protect } = require("../middleware/authMiddleware");
const { authorizePermission } = require("../middleware/permissionMiddleware");

router.post(
  "/",
  protect,
  authorizePermission("MANAGE_PRODUCTS"),
  productController.createProduct
);

module.exports = router;