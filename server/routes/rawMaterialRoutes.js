const express = require("express");
const router = express.Router();
const rawMaterialController = require("../controllers/rawMaterialController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), rawMaterialController.getRawMaterialSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), rawMaterialController.getRawMaterials);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), rawMaterialController.createRawMaterial);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), rawMaterialController.updateRawMaterial);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), rawMaterialController.deleteRawMaterial);

module.exports = router;
