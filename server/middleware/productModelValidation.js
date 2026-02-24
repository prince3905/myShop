const { body } = require("express-validator");

exports.createProductModelValidation = [
  body("shop")
    .notEmpty().withMessage("Shop ID is required")
    .isMongoId().withMessage("Invalid Shop ID"),

  body("product")
    .notEmpty().withMessage("Product ID is required")
    .isMongoId().withMessage("Invalid Product ID"),

  body("name")
    .notEmpty().withMessage("Model name is required")
];