const { body, param } = require("express-validator");
const mongoose = require("mongoose");

exports.createBrandValidation = [
  body("name")
    .notEmpty().withMessage("Brand name is required")
    .isLength({ min: 2 }).withMessage("Brand name too short"),

  body("shop")
    .notEmpty().withMessage("Shop ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid Shop ID");
      }
      return true;
    })
];

exports.updateBrandValidation = [
  param("id").custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid Brand ID");
    }
    return true;
  })
];