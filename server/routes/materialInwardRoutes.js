const express = require("express");
const router = express.Router();
const materialInwardController = require("../controllers/materialInwardController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), materialInwardController.getMaterialInwardSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), materialInwardController.getMaterialInwards);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), materialInwardController.createMaterialInward);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), materialInwardController.updateMaterialInward);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), materialInwardController.deleteMaterialInward);

module.exports = router;
