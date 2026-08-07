const express = require("express");
const stockController = require("../controllers/stockController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");
const { hasFeatureAccess } = require("../utils/featureAccess");

const router = express.Router();

const authorizeStockRead = async (req, res, next) => {
  const isSingleVariationLookup =
    !!`${req.query?.variation || ""}`.trim() &&
    Number(req.query?.page || 1) === 1 &&
    Number(req.query?.limit || 20) <= 1 &&
    !`${req.query?.search || ""}`.trim() &&
    `${req.query?.lowStock || "false"}` !== "true";

  if (await hasFeatureAccess(req.user?.role, "inventory.stocks")) {
    return next();
  }

  if (
    isSingleVariationLookup &&
    (
      await hasFeatureAccess(req.user?.role, "sales.pos") ||
      await hasFeatureAccess(req.user?.role, "inventory.product_details")
    )
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Feature access denied: inventory.stocks",
  });
};

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

// Low Stock Alerts
router.get(
  "/alerts/low-stock",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.getLowStockAlerts,
);

router.get(
  "/",
  authorizeStockRead,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getStockReport,
);
router.get(
  "/transactions",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getTransactions,
);
router.get(
  "/reconciliation/current",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getCurrentReconciliation,
);
router.post(
  "/reconciliation/start",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.startReconciliation,
);
router.put(
  "/reconciliation/:id",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.saveReconciliationLines,
);
router.post(
  "/reconciliation/:id/submit",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.submitReconciliation,
);
router.post(
  "/reconciliation/:id/approve",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  stockController.approveReconciliation,
);
router.post(
  "/adjust",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.manualAdjust,
);

router.post(
  "/transfer",
  authorizeFeature("inventory.stocks"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.transferStockBetweenShops,
);

module.exports = router;
