const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master"), staffController.getStaffSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master"), staffController.getStaffs);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.createStaff);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.updateStaff);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.deleteStaff);

module.exports = router;
