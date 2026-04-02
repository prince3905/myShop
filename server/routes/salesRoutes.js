const express = require("express");
const salesController = require("../controllers/salesController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/customer-suggestions",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getCustomerSuggestions,
);

router.get(
  "/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.listAllSaleReturns,
);

router.get(
  "/reports/overview",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("sales.profit"),
  salesController.getSalesReportOverview,
);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getSales,
);

router.get(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.listSaleReturns,
);

router.get(
  "/:id/ledger",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getSaleLedger,
);

router.post(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  salesController.createSaleReturn,
);

router.post(
  "/:id/payments",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.collectSalePayment,
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getSaleById,
);

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.createSale,
);

module.exports = router;
