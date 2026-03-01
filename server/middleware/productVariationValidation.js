const { body } = require("express-validator");

exports.createVariationValidation = [
  body("product")
    .notEmpty().withMessage("Product is required"),

  body("model")
    .notEmpty().withMessage("Model is required"),

  body("sku")
    .notEmpty().withMessage("SKU is required"),

  body("sellingPrice")
    .isNumeric().withMessage("sellingPrice must be number"),

  body("costPrice")
    .isNumeric().withMessage("Cost price must be number"),

  body("stock")
    .optional()
    .isNumeric().withMessage("Stock must be number")
];

exports.updateVariationValidation = [
  body("sellingPrice")
    .optional()
    .isNumeric().withMessage("sellingPrice must be number"),

  body("costPrice")
    .optional()
    .isNumeric().withMessage("Cost price must be number"),

  body("stock")
    .optional()
    .isNumeric().withMessage("Stock must be number")
];
