const express = require("express");
const purchaseController = require("../controllers/purchaseController");
const purchaseReturnController = require("../controllers/purchaseReturnController");
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.listPurchases,
);
router.get(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseReturnController.listPurchaseReturns,
);
router.post(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  purchaseReturnController.createPurchaseReturn,
);
router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.getPurchaseById,
);
router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  purchaseController.updateDraft,
);
router.patch(
  "/:id/cancel",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  purchaseController.cancelDraft,
);
router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  purchaseController.createDraft,
);
router.post(
  "/:id/confirm",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  purchaseController.confirmPurchase,
);

module.exports = router;
