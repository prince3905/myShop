const { body, param } = require("express-validator");
const mongoose = require("mongoose");

exports.createCategoryValidation = [
  body("name")
    .notEmpty().withMessage("Category name is required")
];

exports.updateCategoryValidation = [
  param("id").custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid Category ID");
    }
    return true;
  })
];
