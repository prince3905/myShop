const express = require("express");
const { protect, attachShop, authorizeRoles, authorizeFeature } = require("../middleware/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get(
  "/overview",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  dashboardController.getOverview,
);
router.get(
  "/kpis",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  dashboardController.getKpis,
);
router.get(
  "/trends",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  dashboardController.getTrends,
);
router.get(
  "/purchase-analytics",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("dashboard.financial"),
  dashboardController.getPurchaseAnalytics,
);
router.get(
  "/return-analytics",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("dashboard.financial"),
  dashboardController.getReturnAnalytics,
);
router.get(
  "/purchase-return-analytics",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  authorizeFeature("dashboard.financial"),
  dashboardController.getPurchaseReturnAnalytics,
);

module.exports = router;
