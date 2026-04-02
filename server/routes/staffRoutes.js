const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffController.getStaffSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffController.getStaffs);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffController.createStaff);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffController.updateStaff);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffController.deleteStaff);

module.exports = router;
