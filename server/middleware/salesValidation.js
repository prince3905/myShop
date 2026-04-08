const { body, query } = require("express-validator");

// SALE CREATION VALIDATION
exports.validateSaleCreation = [
  body("customerName")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("Customer name cannot exceed 100 characters")
    .trim(),
  body("customerPhone")
    .optional()
    .isMobilePhone()
    .withMessage("Invalid phone number format"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item is required"),
  body("items.*.variationId")
    .optional()
    .isMongoId()
    .withMessage("Invalid variation ID"),
  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be at least 1"),
  body("paymentMethod")
    .optional()
    .isIn(["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT", "SPLIT"])
    .withMessage("Invalid payment method"),
  body("billDiscount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount cannot be negative"),
  body("paidAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Paid amount cannot be negative"),
  body("walletUsedAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Wallet amount cannot be negative"),
];
