const express = require("express");
const router = express.Router();
const staffDailyWorkController = require("../controllers/staffDailyWorkController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffDailyWorkController.getDailyWorkSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffDailyWorkController.getDailyWorks);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffDailyWorkController.createDailyWork);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffDailyWorkController.updateDailyWork);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffDailyWorkController.deleteDailyWork);

module.exports = router;
