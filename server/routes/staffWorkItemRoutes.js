const express = require("express");
const router = express.Router();
const staffWorkItemController = require("../controllers/staffWorkItemController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffWorkItemController.getStaffWorkItemSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffWorkItemController.getStaffWorkItems);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkItemController.createStaffWorkItem);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkItemController.updateStaffWorkItem);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffWorkItemController.deleteStaffWorkItem);

module.exports = router;
