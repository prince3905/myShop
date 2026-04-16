const logger = require("../utils/logger");
const DailyExpense = require("../models/DailyExpense");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const normalizeDate = (raw) => {
  if (raw === undefined || raw === null || `${raw}`.trim() === "") {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

exports.createExpense = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const expenseDate = normalizeDate(req.body?.expenseDate) || new Date();
    if (!expenseDate) {
      return res.status(400).json({ success: false, message: "Valid expense date is required" });
    }

    const payload = {
      shop: req.shopId,
      expenseDate,
      category: `${req.body?.category || ""}`.trim(),
      department: `${req.body?.department || ""}`.trim(),
      accountHead: `${req.body?.accountHead || ""}`.trim(),
      amount: Number(req.body?.amount || 0),
      paymentMethod: `${req.body?.paymentMethod || "CASH"}`.trim().toUpperCase(),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    };

    if (!payload.category || !payload.department || !payload.accountHead) {
      return res.status(400).json({ success: false, message: "Category, department and account head are required" });
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const expense = await DailyExpense.create(payload);
    const populated = await DailyExpense.findById(expense._id)
      .populate("createdBy", "email role pFname pLname")
      .populate("shop", "name shopCode");

    return res.status(201).json({
      success: true,
      message: "Daily expense added",
      expense: populated,
    });
  } catch (error) {
    logger.error("Create Daily Expense Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create daily expense" });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      shop: req.shopId,
      isDeleted: false,
    };

    if (STAFF_ONLY_FILTER(req)) {
      filter.createdBy = req.user._id;
    }

    const { category, department, paymentMethod, search, dateFrom, dateTo } = req.query || {};

    if (`${category || ""}`.trim()) {
      filter.category = `${category}`.trim();
    }
    if (`${department || ""}`.trim()) {
      filter.department = `${department}`.trim();
    }
    if (`${paymentMethod || ""}`.trim()) {
      filter.paymentMethod = `${paymentMethod}`.trim().toUpperCase();
    }

    const from = normalizeDate(dateFrom);
    const to = normalizeDate(dateTo);
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = startOfDay(from);
      if (to) filter.expenseDate.$lte = endOfDay(to);
    }

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [
        { category: regex },
        { department: regex },
        { accountHead: regex },
        { note: regex },
      ];
    }

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const skip = (page - 1) * limit;

    const [expenses, totalCount] = await Promise.all([
      DailyExpense.find(filter)
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "email role pFname pLname"),
      DailyExpense.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      expenses,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    logger.error("Get Daily Expenses Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch daily expenses" });
  }
};

exports.getExpenseSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = {
      shop: req.shopId,
      isDeleted: false,
      status: "ACTIVE",
    };

    if (STAFF_ONLY_FILTER(req)) {
      baseMatch.createdBy = req.user._id;
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [totals, todayTotals, byCategory, byDepartment] = await Promise.all([
      DailyExpense.aggregate([
        { $match: baseMatch },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      DailyExpense.aggregate([
        { $match: { ...baseMatch, expenseDate: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      DailyExpense.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$category", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
      ]),
      DailyExpense.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$department", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalAmount: Number(totals?.[0]?.totalAmount || 0),
        totalEntries: Number(totals?.[0]?.count || 0),
        todayAmount: Number(todayTotals?.[0]?.totalAmount || 0),
        todayEntries: Number(todayTotals?.[0]?.count || 0),
        byCategory,
        byDepartment,
      },
    });
  } catch (error) {
    logger.error("Daily Expense Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch expense summary" });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update expenses" });
    }

    const expense = await DailyExpense.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    const expenseDate = req.body?.expenseDate ? normalizeDate(req.body.expenseDate) : expense.expenseDate;
    if (!expenseDate) {
      return res.status(400).json({ success: false, message: "Valid expense date is required" });
    }

    expense.expenseDate = expenseDate;
    expense.category = `${req.body?.category || expense.category || ""}`.trim();
    expense.department = `${req.body?.department || expense.department || ""}`.trim();
    expense.accountHead = `${req.body?.accountHead || expense.accountHead || ""}`.trim();
    expense.amount = Number(req.body?.amount ?? expense.amount ?? 0);
    expense.paymentMethod = `${req.body?.paymentMethod || expense.paymentMethod || "CASH"}`.trim().toUpperCase();
    expense.note = `${req.body?.note ?? expense.note ?? ""}`.trim();
    expense.status = `${req.body?.status || expense.status || "ACTIVE"}`.trim().toUpperCase();
    expense.updatedBy = req.user._id;

    if (!expense.category || !expense.department || !expense.accountHead) {
      return res.status(400).json({ success: false, message: "Category, department and account head are required" });
    }

    if (!Number.isFinite(expense.amount) || expense.amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    await expense.save();

    return res.json({
      success: true,
      message: "Daily expense updated",
      expense,
    });
  } catch (error) {
    logger.error("Update Daily Expense Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update daily expense" });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete expenses" });
    }

    const expense = await DailyExpense.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    return res.json({
      success: true,
      message: "Daily expense deleted",
    });
  } catch (error) {
    logger.error("Delete Daily Expense Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete daily expense" });
  }
};
