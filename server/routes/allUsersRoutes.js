const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// LOGIN ROUTE
router.post("/login", authController.login);

// GET ALL USERS (Protected + Role Based)
router.get(
  "/",
  protect,
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  userController.getAllUsers
);

module.exports = router;