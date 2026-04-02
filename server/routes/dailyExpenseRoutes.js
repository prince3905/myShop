const express = require("express");
const router = express.Router();
const dailyExpenseController = require("../controllers/dailyExpenseController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("expenses.daily"), dailyExpenseController.getExpenseSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("expenses.daily"), dailyExpenseController.getExpenses);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("expenses.daily"), dailyExpenseController.createExpense);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("expenses.daily.manage"), dailyExpenseController.updateExpense);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("expenses.daily.manage"), dailyExpenseController.deleteExpense);

module.exports = router;
