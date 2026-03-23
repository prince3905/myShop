const express = require("express");
const router = express.Router();
const dailyExpenseController = require("../controllers/dailyExpenseController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), dailyExpenseController.getExpenseSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), dailyExpenseController.getExpenses);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), dailyExpenseController.createExpense);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), dailyExpenseController.updateExpense);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), dailyExpenseController.deleteExpense);

module.exports = router;
