const { body, query, validationResult } = require("express-validator");

// VALIDATION RUNNER
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// SALE CREATION VALIDATION
exports.validateSaleCreation = [
  body("customerName")
    .optional({ nullable: true, allowEmpty: true })
    .customSanitizer((value) => value || "")
    .isLength({ max: 100 })
    .withMessage("Customer name cannot exceed 100 characters"),
  body("customerPhone")
    .optional({ nullable: true, allowEmpty: true })
    .customSanitizer((value) => value || "")
    .custom((value) => {
      if (!value || value === "") return true;
      if (!/^\d{10,}$/.test(value)) {
        throw new Error("Invalid phone number format - use 10 digit number");
      }
      return true;
    }),
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
