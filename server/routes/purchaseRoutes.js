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
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
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
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.updateDraft,
);
router.patch(
  "/:id/cancel",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.cancelDraft,
);
router.post(
  "/",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.createDraft,
);
router.post(
  "/:id/confirm",
  authorizeFeature("inventory.purchase"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.confirmPurchase,
);

module.exports = router;
