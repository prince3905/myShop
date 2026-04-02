const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");
const { hasFeatureAccess } = require("../utils/featureAccess");

const authorizeStaffOptionsAccess = async (req, res, next) => {
  const role = req.user?.role;
  const allowed = await Promise.all([
    hasFeatureAccess(role, "staff.master"),
    hasFeatureAccess(role, "staff.daily_work"),
    hasFeatureAccess(role, "staff.payments"),
    hasFeatureAccess(role, "staff.summary"),
  ]);

  if (allowed.some(Boolean)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Feature access denied: staff options",
  });
};

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master"), staffController.getStaffSummary);
router.get("/options", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeStaffOptionsAccess, staffController.getStaffs);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master"), staffController.getStaffs);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.createStaff);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.updateStaff);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.master.manage"), staffController.deleteStaff);

module.exports = router;
