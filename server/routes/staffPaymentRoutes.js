const express = require("express");
const router = express.Router();
const staffPaymentController = require("../controllers/staffPaymentController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffPaymentController.getStaffPaymentSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffPaymentController.getStaffPayments);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), staffPaymentController.createStaffPayment);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffPaymentController.updateStaffPayment);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), staffPaymentController.deleteStaffPayment);

module.exports = router;
