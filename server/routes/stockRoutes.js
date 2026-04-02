const express = require("express");
const stockController = require("../controllers/stockController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeFeature("inventory.stocks"),
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

module.exports = router;
