const { body, param } = require("express-validator");
const mongoose = require("mongoose");

exports.createCategoryValidation = [
  body("name")
    .notEmpty().withMessage("Category name is required"),

  body("shop")
    .notEmpty().withMessage("Shop ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid Shop ID");
      }
      return true;
    })
];

exports.updateCategoryValidation = [
  param("id").custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid Category ID");
    }
    return true;
  })
];