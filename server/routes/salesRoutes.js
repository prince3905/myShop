const express = require("express");
const salesController = require("../controllers/salesController");
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get(
  "/customer-suggestions",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getCustomerSuggestions,
);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.getSales,
);

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  salesController.createSale,
);

module.exports = router;
