const logger = require("../utils/logger");
const StaffWorkType = require("../models/StaffWorkType");

const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.getStaffWorkTypes = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      shop: req.shopId,
      isDeleted: false,
    };

    if (`${req.query?.active || ""}`.trim()) {
      filter.active = `${req.query.active}`.trim() === "true";
    }

    const workTypes = await StaffWorkType.find(filter).sort({ active: -1, name: 1 });
    return res.json({ success: true, workTypes });
  } catch (error) {
    logger.error("Get Staff Work Types Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch work types" });
  }
};

exports.createStaffWorkType = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const role = `${req.user?.role || ""}`;
    if (!MANAGER_AND_ABOVE.includes(role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work types" });
    }

    const name = `${req.body?.name || ""}`.trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Work type name is required" });
    }

    const exists = await StaffWorkType.findOne({
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (exists) {
      return res.status(409).json({ success: false, message: "Work type already exists" });
    }

    const workType = await StaffWorkType.create({
      shop: req.shopId,
      name,
      description: `${req.body?.description || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Work type added", workType });
  } catch (error) {
    logger.error("Create Staff Work Type Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create work type" });
  }
};

exports.updateStaffWorkType = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const role = `${req.user?.role || ""}`;
    if (!MANAGER_AND_ABOVE.includes(role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work types" });
    }

    const workType = await StaffWorkType.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });
    if (!workType) {
      return res.status(404).json({ success: false, message: "Work type not found" });
    }

    const name = `${req.body?.name || workType.name || ""}`.trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Work type name is required" });
    }

    const existing = await StaffWorkType.findOne({
      _id: { $ne: workType._id },
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "Work type already exists" });
    }

    workType.name = name;
    workType.description = `${req.body?.description ?? workType.description ?? ""}`.trim();
    workType.active = req.body?.active !== undefined ? !!req.body.active : workType.active;
    workType.updatedBy = req.user._id;
    await workType.save();

    return res.json({ success: true, message: "Work type updated", workType });
  } catch (error) {
    logger.error("Update Staff Work Type Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update work type" });
  }
};

exports.deleteStaffWorkType = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const role = `${req.user?.role || ""}`;
    if (!MANAGER_AND_ABOVE.includes(role)) {
      return res.status(403).json({ success: false, message: "You do not have permission to manage work types" });
    }

    const workType = await StaffWorkType.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );
    if (!workType) {
      return res.status(404).json({ success: false, message: "Work type not found" });
    }

    return res.json({ success: true, message: "Work type deleted" });
  } catch (error) {
    logger.error("Delete Staff Work Type Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete work type" });
  }
};
