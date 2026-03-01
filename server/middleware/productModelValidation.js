const { body } = require("express-validator");

exports.createProductModelValidation = [
  body("product")
    .notEmpty().withMessage("Product ID is required")
    .isMongoId().withMessage("Invalid Product ID"),

  body("name")
    .notEmpty().withMessage("Model name is required")
];
