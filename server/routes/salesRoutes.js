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

router.post(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  authorizeFeature("sales.return"),
  salesController.createSaleReturn,
);

router.post(
  "/:id/payments",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.payment"),
  salesController.collectSalePayment,
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.list"),
  salesController.getSaleById,
);

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeFeature("sales.create"),
  salesController.createSale,
);

module.exports = router;
