const express = require("express");
const purchaseController = require("../controllers/purchaseController");
const purchaseReturnController = require("../controllers/purchaseReturnController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.listPurchases,
);
router.get(
  "/:id/returns",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseReturnController.listPurchaseReturns,
);
router.post(
  "/:id/returns",
  authorizeFeature("inventory.purchase.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseReturnController.createPurchaseReturn,
);
router.get(
  "/:id",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.getPurchaseById,
);
router.put(
  "/:id",
  authorizeFeature("inventory.purchase.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.updateDraft,
);
router.patch(
  "/:id/cancel",
  authorizeFeature("inventory.purchase.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.cancelDraft,
);
router.post(
  "/",
  authorizeFeature("inventory.purchase.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.createDraft,
);
router.post(
  "/:id/confirm",
  authorizeFeature("inventory.purchase.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  purchaseController.confirmPurchase,
);

module.exports = router;
