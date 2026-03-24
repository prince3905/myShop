const Staff = require("../models/Staff");
const StaffWorkType = require("../models/StaffWorkType");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

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

    const staff = await Staff.create(payload);
    const populated = await Staff.findById(staff._id).populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Staff added",
      staff: populated,
    });
  } catch (error) {
    console.error("Create Staff Error:", error);
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

    if (STAFF_ONLY_FILTER(req)) {
      filter.createdBy = req.user._id;
    }

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
    console.error("Get Staffs Error:", error);
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

    if (STAFF_ONLY_FILTER(req)) {
      baseMatch.createdBy = req.user._id;
    }

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
    console.error("Staff Summary Error:", error);
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

    await staff.save();

    return res.json({
      success: true,
      message: "Staff updated",
      staff,
    });
  } catch (error) {
    console.error("Update Staff Error:", error);
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
    console.error("Delete Staff Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete staff" });
  }
};
