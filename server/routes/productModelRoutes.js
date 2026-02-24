const express = require("express");
const router = express.Router();

const productModelController = require("../controllers/productModelController");
const { createProductModelValidation } = require("../middleware/productModelValidation");
const { validate } = require("../middleware/validate");

router.post(
  "/",
  createProductModelValidation,
  validate,
  productModelController.createProductModel
);

router.get("/", productModelController.getProductModels);

module.exports = router;