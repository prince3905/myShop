const ScrapRegister = require("../models/ScrapRegister");

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

exports.createScrap = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const entryDate = normalizeDate(req.body?.entryDate);
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const payload = {
      shop: req.shopId,
      entryDate,
      itemName: `${req.body?.itemName || ""}`.trim(),
      sourceType: `${req.body?.sourceType || "PRODUCTION"}`.trim().toUpperCase(),
      sourceRef: `${req.body?.sourceRef || ""}`.trim(),
      qty: Number(req.body?.qty || 0),
      unitLabel: `${req.body?.unitLabel || "KG"}`.trim().toUpperCase(),
      estimatedValue: Number(req.body?.estimatedValue || 0),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    };

    if (!payload.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    if (!["PRODUCTION", "RAW_MATERIAL", "CUTTING", "OTHER"].includes(payload.sourceType)) {
      return res.status(400).json({ success: false, message: "Invalid source type" });
    }

    if (!Number.isFinite(payload.qty) || payload.qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    if (!Number.isFinite(payload.estimatedValue) || payload.estimatedValue < 0) {
      return res.status(400).json({ success: false, message: "Estimated value must be 0 or greater" });
    }

    const scrap = await ScrapRegister.create(payload);
    const populated = await ScrapRegister.findById(scrap._id).populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Scrap entry added",
      scrap: populated,
    });
  } catch (error) {
    console.error("Create Scrap Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create scrap entry" });
  }
};

exports.getScraps = async (req, res) => {
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

    const { search, sourceType, dateFrom, dateTo } = req.query || {};
    if (`${sourceType || ""}`.trim()) {
      filter.sourceType = `${sourceType}`.trim().toUpperCase();
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
      filter.$or = [
        { itemName: regex },
        { sourceRef: regex },
        { note: regex },
      ];
    }

    const scraps = await ScrapRegister.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, scraps });
  } catch (error) {
    console.error("Get Scrap Entries Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch scrap entries" });
  }
};

exports.getScrapSummary = async (req, res) => {
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

    const [totals, bySource, today] = await Promise.all([
      ScrapRegister.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQty: { $sum: "$qty" },
            totalValue: { $sum: "$estimatedValue" },
          },
        },
      ]),
      ScrapRegister.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$sourceType", totalQty: { $sum: "$qty" }, count: { $sum: 1 } } },
        { $sort: { totalQty: -1 } },
      ]),
      ScrapRegister.aggregate([
        { $match: { ...baseMatch, entryDate: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } } },
        { $group: { _id: null, todayQty: { $sum: "$qty" }, todayEntries: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalEntries: Number(totals?.[0]?.totalEntries || 0),
        totalQty: Number(totals?.[0]?.totalQty || 0),
        totalValue: Number(totals?.[0]?.totalValue || 0),
        todayQty: Number(today?.[0]?.todayQty || 0),
        todayEntries: Number(today?.[0]?.todayEntries || 0),
        bySource,
      },
    });
  } catch (error) {
    console.error("Scrap Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch scrap summary" });
  }
};

exports.updateScrap = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update scrap entries" });
    }

    const scrap = await ScrapRegister.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!scrap) {
      return res.status(404).json({ success: false, message: "Scrap entry not found" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : scrap.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    scrap.entryDate = entryDate;
    scrap.itemName = `${req.body?.itemName || scrap.itemName || ""}`.trim();
    scrap.sourceType = `${req.body?.sourceType || scrap.sourceType || "PRODUCTION"}`.trim().toUpperCase();
    scrap.sourceRef = `${req.body?.sourceRef ?? scrap.sourceRef ?? ""}`.trim();
    scrap.qty = Number(req.body?.qty ?? scrap.qty ?? 0);
    scrap.unitLabel = `${req.body?.unitLabel || scrap.unitLabel || "KG"}`.trim().toUpperCase();
    scrap.estimatedValue = Number(req.body?.estimatedValue ?? scrap.estimatedValue ?? 0);
    scrap.note = `${req.body?.note ?? scrap.note ?? ""}`.trim();
    scrap.updatedBy = req.user._id;

    if (!scrap.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    if (!["PRODUCTION", "RAW_MATERIAL", "CUTTING", "OTHER"].includes(scrap.sourceType)) {
      return res.status(400).json({ success: false, message: "Invalid source type" });
    }

    if (!Number.isFinite(scrap.qty) || scrap.qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    if (!Number.isFinite(scrap.estimatedValue) || scrap.estimatedValue < 0) {
      return res.status(400).json({ success: false, message: "Estimated value must be 0 or greater" });
    }

    await scrap.save();

    return res.json({ success: true, message: "Scrap entry updated", scrap });
  } catch (error) {
    console.error("Update Scrap Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update scrap entry" });
  }
};

exports.deleteScrap = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete scrap entries" });
    }

    const scrap = await ScrapRegister.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!scrap) {
      return res.status(404).json({ success: false, message: "Scrap entry not found" });
    }

    return res.json({ success: true, message: "Scrap entry deleted" });
  } catch (error) {
    console.error("Delete Scrap Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete scrap entry" });
  }
};
