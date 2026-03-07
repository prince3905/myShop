const express = require("express");
const purchaseController = require("../controllers/purchaseController");
const purchaseReturnController = require("../controllers/purchaseReturnController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.listPurchases,
);
router.get(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseReturnController.listPurchaseReturns,
);
router.post(
  "/:id/returns",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseReturnController.createPurchaseReturn,
);
router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.getPurchaseById,
);
router.put(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.updateDraft,
);
router.patch(
  "/:id/cancel",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.cancelDraft,
);
router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.createDraft,
);
router.post(
  "/:id/confirm",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  purchaseController.confirmPurchase,
);

module.exports = router;
