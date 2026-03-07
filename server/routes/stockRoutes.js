const express = require("express");
const stockController = require("../controllers/stockController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getStockReport,
);
router.get(
  "/transactions",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getTransactions,
);
router.get(
  "/reconciliation/current",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getCurrentReconciliation,
);
router.post(
  "/reconciliation/start",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.startReconciliation,
);
router.put(
  "/reconciliation/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.saveReconciliationLines,
);
router.post(
  "/reconciliation/:id/submit",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.submitReconciliation,
);
router.post(
  "/reconciliation/:id/approve",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  stockController.approveReconciliation,
);
router.post(
  "/adjust",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.manualAdjust,
);

module.exports = router;
