const express = require("express");
const router = express.Router();
const rawMaterialController = require("../controllers/rawMaterialController");
const {
  protect,
  attachShop,
  authorizeRoles,
  authorizeFeature,
  authorizeAnyFeature,
  requireShopSelectionForWrite,
} = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("factory.raw_material_master"), rawMaterialController.getRawMaterialSummary);
router.get("/:id/history", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("factory.raw_material_master"), rawMaterialController.getRawMaterialHistory);
router.get(
  "/options",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeAnyFeature("factory.raw_material_master", "staff.daily_work", "factory.verification", "factory.report"),
  rawMaterialController.getRawMaterialOptions,
);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("factory.raw_material_master"), rawMaterialController.getRawMaterials);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_master"), rawMaterialController.createRawMaterial);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_master"), rawMaterialController.updateRawMaterial);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.raw_material_master"), rawMaterialController.deleteRawMaterial);

module.exports = router;
