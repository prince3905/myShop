const mongoose = require("mongoose");
const StaffDailyWork = require("../models/StaffDailyWork");
const Staff = require("../models/Staff");
const StaffWorkItem = require("../models/StaffWorkItem");

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

const calculateEarnedAmount = (staff, attendanceStatus, unitsCompleted, incomingAmount, pieceRate) => {
  const explicitAmount = Number(incomingAmount);
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
    return explicitAmount;
  }

  const rate = Number(staff?.rate || 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  if (`${staff?.rateType || ""}` === "PIECE") {
    const resolvedPieceRate = Number(pieceRate ?? staff?.rate ?? 0);
    const units = Number(unitsCompleted || 0);
    return Number.isFinite(units) && units > 0 ? resolvedPieceRate * units : 0;
  }

  if (`${staff?.rateType || ""}` === "MONTHLY") {
    if (attendanceStatus === "ABSENT") {
      return 0;
    }
    const dailyEquivalent = rate / 30;
    return attendanceStatus === "HALF_DAY" ? dailyEquivalent / 2 : dailyEquivalent;
  }

  if (attendanceStatus === "HALF_DAY") {
    return rate / 2;
  }
  if (attendanceStatus === "ABSENT") {
    return 0;
  }
  return rate;
};

const resolveWorkItem = async (req, staff, rawWorkItemId) => {
  const workItemId = `${rawWorkItemId || ""}`.trim();
  if (!workItemId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(workItemId)) {
    return { error: { status: 400, success: false, message: "Valid work item is required" } };
  }

  const item = await StaffWorkItem.findOne({
    _id: workItemId,
    shop: req.shopId,
    isDeleted: false,
  });

  if (!item) {
    return { error: { status: 404, success: false, message: "Work item not found" } };
  }

  if (`${staff?.workType || ""}`.trim() && `${item.workType || ""}`.trim() !== `${staff.workType || ""}`.trim()) {
    return { error: { status: 400, success: false, message: "Selected item does not belong to the staff work type" } };
  }

  return item;
};

exports.createDailyWork = async (req, res) => {
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

    const attendanceStatus = `${req.body?.attendanceStatus || "PRESENT"}`.trim().toUpperCase();
    if (!["PRESENT", "HALF_DAY", "ABSENT"].includes(attendanceStatus)) {
      return res.status(400).json({ success: false, message: "Invalid attendance status" });
    }

    const unitsCompleted = Number(req.body?.unitsCompleted || 0);
    if (!Number.isFinite(unitsCompleted) || unitsCompleted < 0) {
      return res.status(400).json({ success: false, message: "Units completed must be 0 or greater" });
    }

    const workItem = await resolveWorkItem(req, staff, req.body?.workItem);
    if (workItem?.error) {
      return res.status(workItem.error.status).json(workItem.error);
    }
    if (`${staff?.rateType || ""}` === "PIECE" && !workItem) {
      return res.status(400).json({ success: false, message: "Piece-rate staff requires a work item" });
    }

    const dailyWork = await StaffDailyWork.create({
      shop: req.shopId,
      staff: staff._id,
      entryDate,
      attendanceStatus,
      workType: `${req.body?.workType || staff.workType || ""}`.trim(),
      workItem: workItem?._id || null,
      workItemName: `${workItem?.itemName || ""}`.trim(),
      unit: `${workItem?.unit || "PCS"}`.trim(),
      pieceRate: Number(workItem?.pieceRate || 0),
      workDetails: `${req.body?.workDetails || ""}`.trim(),
      linkedJob: `${req.body?.linkedJob || ""}`.trim(),
      unitsCompleted,
      earnedAmount: calculateEarnedAmount(
        staff,
        attendanceStatus,
        unitsCompleted,
        req.body?.earnedAmount,
        workItem?.pieceRate,
      ),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    });

    const populated = await StaffDailyWork.findById(dailyWork._id)
      .populate("staff", "name phone staffType workType rateType rate active")
      .populate("workItem", "itemName workType pieceRate unit active")
      .populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Daily work entry added",
      dailyWork: populated,
    });
  } catch (error) {
    console.error("Create Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create daily work entry" });
  }
};

exports.getDailyWorks = async (req, res) => {
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
      return res.json({ success: true, dailyWorks: [] });
    }
    if (staffIds) {
      filter.staff = { $in: staffIds };
    }

    const { search, staff, attendanceStatus, dateFrom, dateTo } = req.query || {};

    if (`${staff || ""}`.trim() && mongoose.Types.ObjectId.isValid(`${staff}`.trim())) {
      filter.staff = new mongoose.Types.ObjectId(`${staff}`.trim());
    }
    if (`${attendanceStatus || ""}`.trim()) {
      filter.attendanceStatus = `${attendanceStatus}`.trim().toUpperCase();
    }

    const from = normalizeDate(dateFrom);
    const to = normalizeDate(dateTo);
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = startOfDay(from);
      if (to) filter.entryDate.$lte = endOfDay(to);
    }

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      const staffMatches = await Staff.find({
        shop: req.shopId,
        isDeleted: false,
        $or: [{ name: regex }, { phone: regex }, { workType: regex }],
      }).select("_id");
      const matchedIds = staffMatches.map((row) => row._id);
      filter.$or = [
        { workType: regex },
        { workItemName: regex },
        { workDetails: regex },
        { linkedJob: regex },
        { note: regex },
      ];
      if (matchedIds.length) {
        filter.$or.push({ staff: { $in: matchedIds } });
      }
    }

    const dailyWorks = await StaffDailyWork.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("staff", "name phone staffType workType rateType rate active")
      .populate("workItem", "itemName workType pieceRate unit active")
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, dailyWorks });
  } catch (error) {
    console.error("Get Staff Daily Works Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch daily work entries" });
  }
};

exports.getDailyWorkSummary = async (req, res) => {
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
          totalEntries: 0,
          presentCount: 0,
          halfDayCount: 0,
          absentCount: 0,
          totalEarned: 0,
          totalUnitsCompleted: 0,
          byAttendance: [],
        },
      });
    }
    if (staffIds) {
      baseMatch.staff = { $in: staffIds };
    }

    const [totals, byAttendance] = await Promise.all([
      StaffDailyWork.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalEarned: { $sum: "$earnedAmount" },
            totalUnitsCompleted: { $sum: "$unitsCompleted" },
          },
        },
      ]),
      StaffDailyWork.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$attendanceStatus",
            count: { $sum: 1 },
            totalEarned: { $sum: "$earnedAmount" },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalEntries: Number(totals?.[0]?.totalEntries || 0),
        presentCount: Number(byAttendance.find((row) => row._id === "PRESENT")?.count || 0),
        halfDayCount: Number(byAttendance.find((row) => row._id === "HALF_DAY")?.count || 0),
        absentCount: Number(byAttendance.find((row) => row._id === "ABSENT")?.count || 0),
        totalEarned: Number(totals?.[0]?.totalEarned || 0),
        totalUnitsCompleted: Number(totals?.[0]?.totalUnitsCompleted || 0),
        byAttendance,
      },
    });
  } catch (error) {
    console.error("Staff Daily Work Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch daily work summary" });
  }
};

exports.updateDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update daily work entries" });
    }

    const dailyWork = await StaffDailyWork.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    const staffId = `${req.body?.staff || dailyWork.staff || ""}`.trim();
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

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : dailyWork.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const attendanceStatus = `${req.body?.attendanceStatus || dailyWork.attendanceStatus || "PRESENT"}`.trim().toUpperCase();
    if (!["PRESENT", "HALF_DAY", "ABSENT"].includes(attendanceStatus)) {
      return res.status(400).json({ success: false, message: "Invalid attendance status" });
    }

    const unitsCompleted = Number(req.body?.unitsCompleted ?? dailyWork.unitsCompleted ?? 0);
    if (!Number.isFinite(unitsCompleted) || unitsCompleted < 0) {
      return res.status(400).json({ success: false, message: "Units completed must be 0 or greater" });
    }

    const workItem = await resolveWorkItem(req, staff, req.body?.workItem ?? dailyWork.workItem);
    if (workItem?.error) {
      return res.status(workItem.error.status).json(workItem.error);
    }
    if (`${staff?.rateType || ""}` === "PIECE" && !workItem) {
      return res.status(400).json({ success: false, message: "Piece-rate staff requires a work item" });
    }

    dailyWork.staff = staff._id;
    dailyWork.entryDate = entryDate;
    dailyWork.attendanceStatus = attendanceStatus;
    dailyWork.workType = `${req.body?.workType || dailyWork.workType || staff.workType || ""}`.trim();
    dailyWork.workItem = workItem?._id || null;
    dailyWork.workItemName = `${workItem?.itemName || ""}`.trim();
    dailyWork.unit = `${workItem?.unit || dailyWork.unit || "PCS"}`.trim();
    dailyWork.pieceRate = Number(workItem?.pieceRate || 0);
    dailyWork.workDetails = `${req.body?.workDetails ?? dailyWork.workDetails ?? ""}`.trim();
    dailyWork.linkedJob = `${req.body?.linkedJob ?? dailyWork.linkedJob ?? ""}`.trim();
    dailyWork.unitsCompleted = unitsCompleted;
    dailyWork.earnedAmount = calculateEarnedAmount(
      staff,
      attendanceStatus,
      unitsCompleted,
      req.body?.earnedAmount ?? dailyWork.earnedAmount,
      workItem?.pieceRate ?? dailyWork.pieceRate,
    );
    dailyWork.note = `${req.body?.note ?? dailyWork.note ?? ""}`.trim();
    dailyWork.updatedBy = req.user._id;

    await dailyWork.save();

    return res.json({ success: true, message: "Daily work entry updated", dailyWork });
  } catch (error) {
    console.error("Update Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update daily work entry" });
  }
};

exports.deleteDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete daily work entries" });
    }

    const dailyWork = await StaffDailyWork.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    return res.json({ success: true, message: "Daily work entry deleted" });
  } catch (error) {
    console.error("Delete Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete daily work entry" });
  }
};
