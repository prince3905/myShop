const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middle-ware/authMiddleware");
const fraudDetectionController = require("../controllers/fraudDetectionController");

router.use(protect);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  fraudDetectionController.getFraudDetectionReport
);

module.exports = router;
