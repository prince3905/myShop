const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Staff = require("../models/Staff");
const StaffWorkType = require("../models/StaffWorkType");
const StaffDailyWork = require("../models/StaffDailyWork");
const StaffPayment = require("../models/StaffPayment");
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveWorkType = async (req, rawWorkTypeRef, rawWorkTypeName) => {
  const workTypeRef = `${rawWorkTypeRef || ""}`.trim();
  const workTypeName = `${rawWorkTypeName || ""}`.trim();

  if (workTypeRef) {
    const workType = await StaffWorkType.findOne({
      _id: workTypeRef,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!workType) {
      return { error: { success: false, message: "Selected work type not found", status: 404 } };
    }

    return {
      workType: workType.name,
      workTypeRef: workType._id,
    };
  }

  return {
    workType: workTypeName,
    workTypeRef: null,
  };
};

exports.createStaff = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const resolvedWorkType = await resolveWorkType(req, req.body?.workTypeRef, req.body?.workType);
    if (resolvedWorkType.error) {
      return res.status(resolvedWorkType.error.status).json(resolvedWorkType.error);
    }

    const payload = {
      shop: req.shopId,
      name: `${req.body?.name || ""}`.trim(),
      phone: `${req.body?.phone || ""}`.trim(),
      staffType: `${req.body?.staffType || "Worker"}`.trim(),
      workType: `${resolvedWorkType.workType || ""}`.trim(),
      workTypeRef: resolvedWorkType.workTypeRef,
      rateType: `${req.body?.rateType || "DAILY"}`.trim().toUpperCase(),
      rate: Number(req.body?.rate || 0),
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    };

    if (!payload.name || !payload.workType) {
      return res.status(400).json({ success: false, message: "Name and work type are required" });
    }

    if (!["MONTHLY", "DAILY", "PIECE"].includes(payload.rateType)) {
      return res.status(400).json({ success: false, message: "Pay basis must be MONTHLY, DAILY or PIECE" });
    }

    if (!Number.isFinite(payload.rate) || payload.rate < 0) {
      return res.status(400).json({ success: false, message: "Rate must be 0 or greater" });
    }

    if (payload.phone) {
      const existingPhone = await Staff.findOne({
        shop: req.shopId,
        isDeleted: false,
        phone: payload.phone,
      }).select("_id name");
      if (existingPhone) {
        return res.status(409).json({ success: false, message: `Phone already used by ${existingPhone.name}` });
      }
    }

    const existingStaff = await Staff.findOne({
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(payload.name)}$`, "i"),
      workType: new RegExp(`^${escapeRegex(payload.workType)}$`, "i"),
    }).select("_id name workType");
    if (existingStaff) {
      return res.status(409).json({ success: false, message: `Staff "${existingStaff.name}" with work type "${existingStaff.workType}" already exists` });
    }

    const staff = await Staff.create(payload);
    const populated = await Staff.findById(staff._id).populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Staff added",
      staff: populated,
    });
  } catch (error) {
    logger.error("Create Staff Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create staff" });
  }
};

exports.getStaffs = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      shop: req.shopId,
      isDeleted: false,
    };

    const { search, workType, rateType, active, staffType } = req.query || {};
    if (`${workType || ""}`.trim()) {
      filter.workType = `${workType}`.trim();
    }
    if (`${staffType || ""}`.trim()) {
      filter.staffType = `${staffType}`.trim();
    }
    if (`${rateType || ""}`.trim()) {
      filter.rateType = `${rateType}`.trim().toUpperCase();
    }
    if (`${active || ""}`.trim()) {
      filter.active = `${active}`.trim() === "true";
    }
    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [
        { name: regex },
        { phone: regex },
        { workType: regex },
        { staffType: regex },
        { note: regex },
      ];
    }

    const staffs = await Staff.find(filter)
      .sort({ active: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname")
      .populate("workTypeRef", "name active");

    return res.json({ success: true, staffs });
  } catch (error) {
    logger.error("Get Staffs Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff list" });
  }
};

exports.getStaffSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = {
      shop: req.shopId,
      isDeleted: false,
    };

    const [totals, byWorkType, activeCount, byStaffType, byRateType] = await Promise.all([
      Staff.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalStaffs: { $sum: 1 },
            totalDailyRate: { $sum: "$rate" },
          },
        },
      ]),
      Staff.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$workType", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 6 },
      ]),
      Staff.countDocuments({ ...baseMatch, active: true }),
      Staff.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$staffType", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Staff.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$rateType", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalStaffs: Number(totals?.[0]?.totalStaffs || 0),
        totalRateBase: Number(totals?.[0]?.totalDailyRate || 0),
        activeStaffs: Number(activeCount || 0),
        inactiveStaffs: Number((totals?.[0]?.totalStaffs || 0) - activeCount || 0),
        byWorkType,
        byStaffType,
        byRateType,
      },
    });
  } catch (error) {
    logger.error("Staff Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff summary" });
  }
};

exports.updateStaff = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update staff" });
    }

    const staff = await Staff.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    const resolvedWorkType = await resolveWorkType(
      req,
      req.body?.workTypeRef ?? staff.workTypeRef,
      req.body?.workType ?? staff.workType,
    );
    if (resolvedWorkType.error) {
      return res.status(resolvedWorkType.error.status).json(resolvedWorkType.error);
    }

    staff.name = `${req.body?.name || staff.name || ""}`.trim();
    staff.phone = `${req.body?.phone ?? staff.phone ?? ""}`.trim();
    staff.staffType = `${req.body?.staffType || staff.staffType || "Worker"}`.trim();
    staff.workType = `${resolvedWorkType.workType || ""}`.trim();
    staff.workTypeRef = resolvedWorkType.workTypeRef;
    staff.rateType = `${req.body?.rateType || staff.rateType || "DAILY"}`.trim().toUpperCase();
    staff.rate = Number(req.body?.rate ?? staff.rate ?? 0);
    staff.note = `${req.body?.note ?? staff.note ?? ""}`.trim();
    staff.active = req.body?.active !== undefined ? !!req.body.active : staff.active;
    staff.updatedBy = req.user._id;

    if (!staff.name || !staff.workType) {
      return res.status(400).json({ success: false, message: "Name and work type are required" });
    }

    if (!["MONTHLY", "DAILY", "PIECE"].includes(staff.rateType)) {
      return res.status(400).json({ success: false, message: "Pay basis must be MONTHLY, DAILY or PIECE" });
    }

    if (!Number.isFinite(staff.rate) || staff.rate < 0) {
      return res.status(400).json({ success: false, message: "Rate must be 0 or greater" });
    }

    if (staff.phone) {
      const existingPhone = await Staff.findOne({
        _id: { $ne: staff._id },
        shop: req.shopId,
        isDeleted: false,
        phone: staff.phone,
      }).select("_id name");
      if (existingPhone) {
        return res.status(409).json({ success: false, message: `Phone already used by ${existingPhone.name}` });
      }
    }

    const existingStaff = await Staff.findOne({
      _id: { $ne: staff._id },
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(staff.name)}$`, "i"),
      workType: new RegExp(`^${escapeRegex(staff.workType)}$`, "i"),
    }).select("_id name workType");
    if (existingStaff) {
      return res.status(409).json({ success: false, message: `Staff "${existingStaff.name}" with work type "${existingStaff.workType}" already exists` });
    }

    await staff.save();

    return res.json({
      success: true,
      message: "Staff updated",
      staff,
    });
  } catch (error) {
    logger.error("Update Staff Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update staff" });
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete staff" });
    }

    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    return res.json({ success: true, message: "Staff deleted" });
  } catch (error) {
    logger.error("Delete Staff Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete staff" });
  }
};

exports.getStaffLedger = async (req, res) => {
  try {
    const staffId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Invalid staff ID" });
    }

    const staff = await Staff.findById(staffId).populate("shop", "name shopCode");
    if (!staff || staff.isDeleted) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    const [dailyWorks, payments] = await Promise.all([
      StaffDailyWork.find({
        staff: staff._id,
        isDeleted: false,
        verificationStatus: { $in: ["APPROVED", "PARTIAL"] },
      }).lean(),
      StaffPayment.find({
        staff: staff._id,
        isDeleted: { $ne: true },
      }).lean(),
    ]);

    const rawRows = [];

    dailyWorks.forEach((dw) => {
      const earned = Number(dw.earnedAmount || 0);
      const units = Number(dw.unitsCompleted || 0);
      const rate = Number(dw.pieceRate || 0);
      const productName = dw.factoryProductName || "Factory Product";
      rawRows.push({
        date: new Date(dw.entryDate || dw.createdAt || new Date()),
        type: "DAILY_WORK",
        title: `${productName} (${units} Pcs @ ₹${rate}/pc)`,
        description: dw.note || "Verified production daily work",
        verificationStatus: dw.verificationStatus,
        earned,
        paid: 0,
        referenceId: dw._id,
      });
    });

    payments.forEach((sp) => {
      const amount = Number(sp.amount || 0);
      const entryType = sp.entryType || "ADVANCE";
      let title = "Advance Given";
      if (entryType === "PAYMENT") title = "Payment Settlement";
      if (entryType === "KHORAKI") title = "Daily Khoraki (Food Allowance)";

      rawRows.push({
        date: new Date(sp.entryDate || sp.createdAt || new Date()),
        type: entryType,
        title,
        description: sp.note || (entryType === "KHORAKI" ? "Daily food expense payout" : (entryType === "ADVANCE" ? "Cash advance payment" : "Salary settlement payment")),
        paymentMethod: sp.paymentMethod || "CASH",
        earned: 0,
        paid: amount,
        referenceId: sp._id,
      });
    });

    // Sort chronologically ascending to compute running balance
    rawRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let totalEarned = 0;
    let totalAdvance = 0;
    let totalPayment = 0;

    const ledger = rawRows.map((row) => {
      if (row.type === "DAILY_WORK") {
        totalEarned += row.earned;
        runningBalance += row.earned;
      } else if (row.type === "ADVANCE" || row.type === "KHORAKI") {
        totalAdvance += row.paid;
        runningBalance -= row.paid;
      } else if (row.type === "PAYMENT") {
        totalPayment += row.paid;
        runningBalance -= row.paid;
      }

      return {
        ...row,
        runningBalance,
      };
    });

    // Return chronological descending for ledger table view (newest first)
    ledger.reverse();

    return res.json({
      success: true,
      staff: {
        _id: staff._id,
        name: staff.name,
        phone: staff.phone,
        staffType: staff.staffType,
        workType: staff.workType,
        rateType: staff.rateType,
        rate: staff.rate,
        shopCode: staff.shop?.shopCode || "",
        shopName: staff.shop?.name || "",
      },
      summary: {
        totalEarned,
        totalAdvance,
        totalPayment,
        totalPaid: totalAdvance + totalPayment,
        netBalance: runningBalance,
      },
      ledger,
    });
  } catch (error) {
    logger.error("Get Staff Ledger Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch staff ledger" });
  }
};
