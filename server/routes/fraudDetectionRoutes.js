const express = require("express");
const router = express.Router();
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");
const fraudDetectionController = require("../controllers/fraudDetectionController");

router.use(protect);
router.use(attachShop);

router.get(
  "/report",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  fraudDetectionController.getFraudDetectionReport
);

module.exports = router;
