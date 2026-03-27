const express = require("express");
const router = express.Router();
const controller = require("../controllers/rawMaterialPurchaseController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), controller.listPurchases);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.createPurchase);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.updatePurchase);
router.patch("/:id/approve", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.approvePurchase);
router.post("/:id/payment", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.addPayment);
router.patch("/:id/cancel", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), controller.cancelPurchase);

module.exports = router;
