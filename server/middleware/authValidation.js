const { body } = require("express-validator");

// LOGIN VALIDATION
exports.validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

// REGISTER VALIDATION
exports.validateRegister = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  body("role")
    .optional()
    .isIn(["ADMIN", "MANAGER", "STAFF"])
    .withMessage("Role must be ADMIN, MANAGER, or STAFF"),
  body("phoneNo")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number format"),
];

// CUSTOMER CREATION VALIDATION
exports.validateCustomerCreation = [
  body("name")
    .notEmpty()
    .withMessage("Customer name is required")
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2-100 characters")
    .trim(),
  body("phone")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number format"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),
  body("address")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Address cannot exceed 500 characters")
    .trim(),
];
