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
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  userController.getAllUsers
);

// CREATE USER (Protected + Role Based)
router.post(
  "/",
  protect,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  userController.createUser
);

// UPDATE USER (Protected + Role Based)
router.put(
  "/:id",
  protect,
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  userController.updateUser
);

module.exports = router;
