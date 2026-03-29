const mongoose = require("mongoose");
const StaffPayment = require("../models/StaffPayment");
const Staff = require("../models/Staff");

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
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeOptionalDate = (raw) => {
  if (raw === undefined || raw === null || `${raw}`.trim() === "") {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const resolveAccessibleStaffIds = async (req) => {
  if (!STAFF_ONLY_FILTER(req)) {
    return null;
  }
  const staffRows = await Staff.find({
    shop: req.shopId,
    isDeleted: false,
    createdBy: req.user._id,
  }).select("_id");
  return staffRows.map((row) => row._id);
};

exports.createStaffPayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const entryDate = normalizeDate(req.body?.entryDate);
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const staffId = `${req.body?.staff || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Valid staff is required" });
    }

    const staff = await Staff.findOne({
      _id: staffId,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    if (STAFF_ONLY_FILTER(req) && `${staff.createdBy}` !== `${req.user._id}`) {
      return res.status(403).json({ success: false, message: "You can only create entries for your own staff records" });
    }

    const payload = {
      shop: req.shopId,
      staff: staff._id,
      entryDate,
      entryType: `${req.body?.entryType || "ADVANCE"}`.trim().toUpperCase(),
      amount: Number(req.body?.amount || 0),
      paymentMethod: `${req.body?.paymentMethod || "CASH"}`.trim().toUpperCase(),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    };

    if (!["ADVANCE", "PAYMENT"].includes(payload.entryType)) {
      return res.status(400).json({ success: false, message: "Entry type must be ADVANCE or PAYMENT" });
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const created = await StaffPayment.create(payload);
    const payment = await StaffPayment.findById(created._id)
      .populate("staff", "name phone workType rateType rate active")
      .populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Staff entry added",
      payment,
    });
  } catch (error) {
    console.error("Create Staff Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create staff entry" });
  }
};

exports.getStaffPayments = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      shop: req.shopId,
      isDeleted: false,
    };

    const staffIds = await resolveAccessibleStaffIds(req);
    if (staffIds && staffIds.length === 0) {
      return res.json({ success: true, payments: [] });
    }
    if (staffIds) {
      filter.staff = { $in: staffIds };
    }

    const { search, staff, entryType, paymentMethod, dateFrom, dateTo } = req.query || {};

    if (`${staff || ""}`.trim() && mongoose.Types.ObjectId.isValid(`${staff}`.trim())) {
      filter.staff = new mongoose.Types.ObjectId(`${staff}`.trim());
    }
    if (`${entryType || ""}`.trim()) {
      filter.entryType = `${entryType}`.trim().toUpperCase();
    }
    if (`${paymentMethod || ""}`.trim()) {
      filter.paymentMethod = `${paymentMethod}`.trim().toUpperCase();
    }

    const from = normalizeOptionalDate(dateFrom);
    const to = normalizeOptionalDate(dateTo);
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = startOfDay(from);
      if (to) filter.entryDate.$lte = endOfDay(to);
    }

    let staffNameIds = null;
    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      const staffMatches = await Staff.find({
        shop: req.shopId,
        isDeleted: false,
        $or: [{ name: regex }, { phone: regex }, { workType: regex }],
      }).select("_id");
      staffNameIds = staffMatches.map((row) => row._id);
      filter.$or = [{ note: regex }];
      if (staffNameIds.length) {
        filter.$or.push({ staff: { $in: staffNameIds } });
      }
    }

    const payments = await StaffPayment.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("staff", "name phone workType rateType rate active")
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, payments });
  } catch (error) {
    console.error("Get Staff Payments Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff entries" });
  }
};

exports.getStaffPaymentSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = {
      shop: req.shopId,
      isDeleted: false,
    };

    const staffIds = await resolveAccessibleStaffIds(req);
    if (staffIds && staffIds.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalAdvance: 0,
          totalPayment: 0,
          netBalance: 0,
          todayEntries: 0,
          byType: [],
        },
      });
    }
    if (staffIds) {
      baseMatch.staff = { $in: staffIds };
    }

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [totals, todayCount, byType] = await Promise.all([
      StaffPayment.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$entryType",
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      StaffPayment.countDocuments({ ...baseMatch, entryDate: { $gte: todayStart, $lte: todayEnd } }),
      StaffPayment.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$entryType", totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    const totalAdvance = Number(totals.find((row) => row._id === "ADVANCE")?.totalAmount || 0);
    const totalPayment = Number(totals.find((row) => row._id === "PAYMENT")?.totalAmount || 0);

    return res.json({
      success: true,
      summary: {
        totalAdvance,
        totalPayment,
        netBalance: totalAdvance - totalPayment,
        todayEntries: Number(todayCount || 0),
        byType,
      },
    });
  } catch (error) {
    console.error("Staff Payment Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff payment summary" });
  }
};

exports.updateStaffPayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update entries" });
    }

    const payment = await StaffPayment.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : payment.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const staffId = `${req.body?.staff || payment.staff || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Valid staff is required" });
    }

    const staff = await Staff.findOne({
      _id: staffId,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    payment.staff = staff._id;
    payment.entryDate = entryDate;
    payment.entryType = `${req.body?.entryType || payment.entryType || "ADVANCE"}`.trim().toUpperCase();
    payment.amount = Number(req.body?.amount ?? payment.amount ?? 0);
    payment.paymentMethod = `${req.body?.paymentMethod || payment.paymentMethod || "CASH"}`.trim().toUpperCase();
    payment.note = `${req.body?.note ?? payment.note ?? ""}`.trim();
    payment.updatedBy = req.user._id;

    if (!["ADVANCE", "PAYMENT"].includes(payment.entryType)) {
      return res.status(400).json({ success: false, message: "Entry type must be ADVANCE or PAYMENT" });
    }

    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    await payment.save();

    return res.json({ success: true, message: "Entry updated", payment });
  } catch (error) {
    console.error("Update Staff Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update entry" });
  }
};

exports.deleteStaffPayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete entries" });
    }

    const payment = await StaffPayment.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!payment) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    return res.json({ success: true, message: "Entry deleted" });
  } catch (error) {
    console.error("Delete Staff Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete entry" });
  }
};
