const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const { protect, authorizeRoles, authorizeFeature } = require("../middleware/authMiddleware");
const { userRateLimit } = require("../middleware/rateLimiter");

// LOGIN ROUTE
router.post("/login", authController.login);

// GET ALL USERS (Protected + Role Based)
router.get(
  "/",
  protect,
  authorizeFeature("people.users"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  userController.getAllUsers
);

// CREATE USER (Protected + Role Based + Rate Limited)
router.post(
  "/",
  userRateLimit,
  protect,
  authorizeFeature("people.users"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  userController.createUser
);

// UPDATE USER (Protected + Role Based)
router.put(
  "/:id",
  protect,
  authorizeFeature("people.users"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  userController.updateUser
);

// DELETE USER (Protected + Role Based)
router.delete(
  "/:id",
  protect,
  authorizeFeature("people.users"),
  authorizeRoles("SUPER_ADMIN", "ADMIN"),
  userController.deleteUser
);

module.exports = router;
