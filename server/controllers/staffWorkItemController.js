const StaffWorkItem = require("../models/StaffWorkItem");
const StaffWorkType = require("../models/StaffWorkType");

const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const escapeRegex = (value) => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveWorkType = async (req, rawWorkTypeRef, rawWorkType) => {
  const workTypeRef = `${rawWorkTypeRef || ""}`.trim();
  const workTypeName = `${rawWorkType || ""}`.trim();

  if (workTypeRef) {
    const workType = await StaffWorkType.findOne({
      _id: workTypeRef,
      shop: req.shopId,
      isDeleted: false,
    });
    if (!workType) {
      return { error: { status: 404, success: false, message: "Selected work type not found" } };
    }
    return { workTypeRef: workType._id, workType: workType.name };
  }

  return { workTypeRef: null, workType: workTypeName };
};

exports.getStaffWorkItems = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = { shop: req.shopId, isDeleted: false };
    const { workType, active, search } = req.query || {};

    if (`${workType || ""}`.trim()) {
      filter.workType = `${workType}`.trim();
    }
    if (`${active || ""}`.trim()) {
      filter.active = `${active}`.trim() === "true";
    }
    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [{ itemName: regex }, { workType: regex }, { note: regex }];
    }

    const items = await StaffWorkItem.find(filter)
      .sort({ workType: 1, itemName: 1 })
      .populate("workTypeRef", "name")
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, items });
  } catch (error) {
    console.error("Get Staff Work Items Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch work items" });
  }
};

exports.getStaffWorkItemSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = { shop: req.shopId, isDeleted: false };
    const [totals, byWorkType, activeCount] = await Promise.all([
      StaffWorkItem.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            avgRate: { $avg: "$pieceRate" },
            totalRateBase: { $sum: "$pieceRate" },
          },
        },
      ]),
      StaffWorkItem.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$workType", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 8 },
      ]),
      StaffWorkItem.countDocuments({ ...baseMatch, active: true }),
    ]);

    return res.json({
      success: true,
      summary: {
        totalItems: Number(totals?.[0]?.totalItems || 0),
        averageRate: Number(totals?.[0]?.avgRate || 0),
        totalRateBase: Number(totals?.[0]?.totalRateBase || 0),
        activeItems: Number(activeCount || 0),
        inactiveItems: Number((totals?.[0]?.totalItems || 0) - activeCount || 0),
        byWorkType,
      },
    });
  } catch (error) {
    console.error("Staff Work Item Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch work item summary" });
  }
};

exports.createStaffWorkItem = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work items" });
    }

    const resolvedWorkType = await resolveWorkType(req, req.body?.workTypeRef, req.body?.workType);
    if (resolvedWorkType.error) {
      return res.status(resolvedWorkType.error.status).json(resolvedWorkType.error);
    }

    const itemName = `${req.body?.itemName || ""}`.trim();
    const workType = `${resolvedWorkType.workType || ""}`.trim();
    const pieceRate = Number(req.body?.pieceRate || 0);

    if (!workType || !itemName) {
      return res.status(400).json({ success: false, message: "Work type and item name are required" });
    }
    if (!Number.isFinite(pieceRate) || pieceRate < 0) {
      return res.status(400).json({ success: false, message: "Piece rate must be 0 or greater" });
    }

    const exists = await StaffWorkItem.findOne({
      shop: req.shopId,
      isDeleted: false,
      workType,
      itemName: new RegExp(`^${escapeRegex(itemName)}$`, "i"),
    });
    if (exists) {
      return res.status(409).json({ success: false, message: "This work item already exists" });
    }

    const item = await StaffWorkItem.create({
      shop: req.shopId,
      workTypeRef: resolvedWorkType.workTypeRef,
      workType,
      itemName,
      unit: `${req.body?.unit || "PCS"}`.trim().toUpperCase(),
      pieceRate,
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Work item added", item });
  } catch (error) {
    console.error("Create Staff Work Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create work item" });
  }
};

exports.updateStaffWorkItem = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work items" });
    }

    const item = await StaffWorkItem.findOne({ _id: req.params.id, shop: req.shopId, isDeleted: false });
    if (!item) {
      return res.status(404).json({ success: false, message: "Work item not found" });
    }

    const resolvedWorkType = await resolveWorkType(
      req,
      req.body?.workTypeRef ?? item.workTypeRef,
      req.body?.workType ?? item.workType,
    );
    if (resolvedWorkType.error) {
      return res.status(resolvedWorkType.error.status).json(resolvedWorkType.error);
    }

    item.workTypeRef = resolvedWorkType.workTypeRef;
    item.workType = `${resolvedWorkType.workType || ""}`.trim();
    item.itemName = `${req.body?.itemName || item.itemName || ""}`.trim();
    item.unit = `${req.body?.unit || item.unit || "PCS"}`.trim().toUpperCase();
    item.pieceRate = Number(req.body?.pieceRate ?? item.pieceRate ?? 0);
    item.note = `${req.body?.note ?? item.note ?? ""}`.trim();
    item.active = req.body?.active !== undefined ? !!req.body.active : item.active;
    item.updatedBy = req.user._id;

    if (!item.workType || !item.itemName) {
      return res.status(400).json({ success: false, message: "Work type and item name are required" });
    }
    if (!Number.isFinite(item.pieceRate) || item.pieceRate < 0) {
      return res.status(400).json({ success: false, message: "Piece rate must be 0 or greater" });
    }

    await item.save();
    return res.json({ success: true, message: "Work item updated", item });
  } catch (error) {
    console.error("Update Staff Work Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update work item" });
  }
};

exports.deleteStaffWorkItem = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work items" });
    }

    const item = await StaffWorkItem.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Work item not found" });
    }

    return res.json({ success: true, message: "Work item deleted" });
  } catch (error) {
    console.error("Delete Staff Work Item Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete work item" });
  }
};
