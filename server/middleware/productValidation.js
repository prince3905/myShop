const { body, param } = require("express-validator");
const mongoose = require("mongoose");

/* =========================
   CREATE PRODUCT VALIDATION
========================= */
exports.createProductValidation = [

  body("name")
    .notEmpty().withMessage("Product name is required")
    .isLength({ min: 2 }).withMessage("Product name too short"),

  body("category")
    .notEmpty().withMessage("Category ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid Category ID");
      }
      return true;
    }),

  body("brand")
    .notEmpty().withMessage("Brand ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid Brand ID");
      }
      return true;
    })
];


/* =========================
   UPDATE PRODUCT VALIDATION
========================= */
exports.updateProductValidation = [
  param("id").custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid Product ID");
    }
    return true;
  })
];
