const express = require("express");
const router = express.Router();
const controller = require("../controllers/rawMaterialPurchaseController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.listPurchases);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.createPurchase);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.updatePurchase);
router.patch("/:id/approve", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.approvePurchase);
router.post("/:id/payment", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.addPayment);
router.patch("/:id/cancel", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_purchase"), controller.cancelPurchase);

module.exports = router;
