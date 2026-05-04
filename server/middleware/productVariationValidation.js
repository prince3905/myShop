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

  body("quantity")
    .optional()
    .isNumeric().withMessage("Quantity must be number"),

  body("isQuickAdd")
    .optional()
    .isBoolean().withMessage("isQuickAdd must be boolean")
];

exports.updateVariationValidation = [
  body("sellingPrice")
    .optional()
    .isNumeric().withMessage("sellingPrice must be number"),

  body("costPrice")
    .optional()
    .isNumeric().withMessage("Cost price must be number"),

  body("quantity")
    .optional()
    .isNumeric().withMessage("Quantity must be number"),

  body("isQuickAdd")
    .optional()
    .isBoolean().withMessage("isQuickAdd must be boolean")
];
