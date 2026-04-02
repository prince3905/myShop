const express = require("express");
const router = express.Router();
const staffPaymentController = require("../controllers/staffPaymentController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.payments"), staffPaymentController.getStaffPaymentSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.payments"), staffPaymentController.getStaffPayments);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.payments"), staffPaymentController.createStaffPayment);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.payments.manage"), staffPaymentController.updateStaffPayment);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("staff.payments.manage"), staffPaymentController.deleteStaffPayment);

module.exports = router;
