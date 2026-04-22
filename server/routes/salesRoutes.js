const express = require("express");
const salesController = require("../controllers/salesController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");
const { salesRateLimit } = require("../middleware/rateLimiter");
const { validateSaleCreation, validate } = require("../middleware/salesValidation");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

// Apply rate limiting and validation to write endpoints
router.post(
  "/",
  salesRateLimit,
  validateSaleCreation,
  validate,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.create"),
  salesController.createSale,
);

router.post(
  "/:id/returns",
  salesRateLimit,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.return"),
  salesController.createSaleReturn,
);

router.post(
  "/:id/payments",
  salesRateLimit,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.payment"),
  salesController.collectSalePayment,
);

router.get(
  "/customer-suggestions",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.create"),
  salesController.getCustomerSuggestions,
);

router.get(
  "/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.return"),
  salesController.listAllSaleReturns,
);

router.get(
  "/reports/overview",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("sales.profit"),
  salesController.getSalesReportOverview,
);

router.get(
  "/reports/payment-summary",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.list"),
  salesController.getPaymentCollectionSummary,
);

router.get(
  "/reports/z-report",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.list"), // Or a specific feature if you have one
  salesController.getZReport,
);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.list"),
  salesController.getSales,
);

router.get(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.return"),
  salesController.listSaleReturns,
);

router.get(
  "/:id/ledger",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.list"),
  salesController.getSaleLedger,
);

router.get(
  "/:id/audit",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.list"),
  salesController.getSaleAuditLogs,
);

router.get(
  "/audit/all",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("sales.list"),
  salesController.getAllSaleAuditLogs,
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.list"),
  salesController.getSaleById,
);

router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.edit"),
  salesController.updateSale,
);

router.delete(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("sales.delete"),
  salesController.deleteSale,
);

module.exports = router;
