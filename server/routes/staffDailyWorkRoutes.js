const express = require("express");
const router = express.Router();
const staffDailyWorkController = require("../controllers/staffDailyWorkController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffDailyWorkController.getDailyWorkSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffDailyWorkController.getDailyWorks);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffDailyWorkController.createDailyWork);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.daily_work"), staffDailyWorkController.updateDailyWork);
router.patch("/:id/verification", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.verification"), staffDailyWorkController.verifyDailyWork);
router.patch("/:id/push-stock", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.push_to_shop"), staffDailyWorkController.pushDailyWorkToStock);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("staff.daily_work"), staffDailyWorkController.deleteDailyWork);

module.exports = router;
