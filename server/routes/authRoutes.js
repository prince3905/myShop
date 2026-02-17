const express = require("express");
const router = express.Router();
const { login } = require("../controllers/authController");
const { register } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);

module.exports = router;
