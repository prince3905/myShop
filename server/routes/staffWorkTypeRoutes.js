const express = require("express");
const router = express.Router();
const staffWorkTypeController = require("../controllers/staffWorkTypeController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffWorkTypeController.getStaffWorkTypes);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkTypeController.createStaffWorkType);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkTypeController.updateStaffWorkType);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkTypeController.deleteStaffWorkType);

module.exports = router;
