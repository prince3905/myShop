const express = require("express");
const stockController = require("../controllers/stockController");
const { protect, attachShop, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getStockReport,
);
router.get(
  "/transactions",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  stockController.getTransactions,
);
router.post(
  "/adjust",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  stockController.manualAdjust,
);

module.exports = router;
