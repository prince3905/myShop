const express = require("express");
const router = express.Router();
const staffWorkTypeController = require("../controllers/staffWorkTypeController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffWorkTypeController.getStaffWorkTypes);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffWorkTypeController.createStaffWorkType);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffWorkTypeController.updateStaffWorkType);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffWorkTypeController.deleteStaffWorkType);

module.exports = router;
