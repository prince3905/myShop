const FinishedGoodsRegister = require("../models/FinishedGoodsRegister");

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

exports.createFinishedGoods = async (req, res) => {
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
      serialNo: `${req.body?.serialNo || ""}`.trim(),
      batchNo: `${req.body?.batchNo || ""}`.trim(),
      qtyReady: Number(req.body?.qtyReady || 0),
      unitLabel: `${req.body?.unitLabel || "PCS"}`.trim().toUpperCase(),
      estimatedUnitValue: Number(req.body?.estimatedUnitValue || 0),
      linkedProductionRef: `${req.body?.linkedProductionRef || ""}`.trim(),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    };

    if (!payload.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }
    if (!Number.isFinite(payload.qtyReady) || payload.qtyReady <= 0) {
      return res.status(400).json({ success: false, message: "Ready quantity must be greater than 0" });
    }
    if (!Number.isFinite(payload.estimatedUnitValue) || payload.estimatedUnitValue < 0) {
      return res.status(400).json({ success: false, message: "Estimated unit value must be 0 or greater" });
    }

    const created = await FinishedGoodsRegister.create(payload);
    const finishedGoods = await FinishedGoodsRegister.findById(created._id).populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Finished goods entry added",
      finishedGoods,
    });
  } catch (error) {
    console.error("Create Finished Goods Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create finished goods entry" });
  }
};

exports.getFinishedGoods = async (req, res) => {
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

    const { search, dateFrom, dateTo } = req.query || {};
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
        { serialNo: regex },
        { batchNo: regex },
        { linkedProductionRef: regex },
        { note: regex },
      ];
    }

    const finishedGoods = await FinishedGoodsRegister.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, finishedGoods });
  } catch (error) {
    console.error("Get Finished Goods Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch finished goods entries" });
  }
};

exports.getFinishedGoodsSummary = async (req, res) => {
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

    const [totals, today, byItem] = await Promise.all([
      FinishedGoodsRegister.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQtyReady: { $sum: "$qtyReady" },
            totalValue: { $sum: { $multiply: ["$qtyReady", "$estimatedUnitValue"] } },
          },
        },
      ]),
      FinishedGoodsRegister.aggregate([
        { $match: { ...baseMatch, entryDate: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } } },
        {
          $group: {
            _id: null,
            todayEntries: { $sum: 1 },
            todayQtyReady: { $sum: "$qtyReady" },
          },
        },
      ]),
      FinishedGoodsRegister.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$itemName",
            totalQtyReady: { $sum: "$qtyReady" },
            totalValue: { $sum: { $multiply: ["$qtyReady", "$estimatedUnitValue"] } },
          },
        },
        { $sort: { totalQtyReady: -1 } },
        { $limit: 5 },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalEntries: Number(totals?.[0]?.totalEntries || 0),
        totalQtyReady: Number(totals?.[0]?.totalQtyReady || 0),
        totalValue: Number(totals?.[0]?.totalValue || 0),
        todayEntries: Number(today?.[0]?.todayEntries || 0),
        todayQtyReady: Number(today?.[0]?.todayQtyReady || 0),
        byItem,
      },
    });
  } catch (error) {
    console.error("Finished Goods Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch finished goods summary" });
  }
};

exports.updateFinishedGoods = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update entries" });
    }

    const finishedGoods = await FinishedGoodsRegister.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!finishedGoods) {
      return res.status(404).json({ success: false, message: "Finished goods entry not found" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : finishedGoods.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    finishedGoods.entryDate = entryDate;
    finishedGoods.itemName = `${req.body?.itemName || finishedGoods.itemName || ""}`.trim();
    finishedGoods.serialNo = `${req.body?.serialNo ?? finishedGoods.serialNo ?? ""}`.trim();
    finishedGoods.batchNo = `${req.body?.batchNo ?? finishedGoods.batchNo ?? ""}`.trim();
    finishedGoods.qtyReady = Number(req.body?.qtyReady ?? finishedGoods.qtyReady ?? 0);
    finishedGoods.unitLabel = `${req.body?.unitLabel ?? finishedGoods.unitLabel ?? "PCS"}`.trim().toUpperCase();
    finishedGoods.estimatedUnitValue = Number(req.body?.estimatedUnitValue ?? finishedGoods.estimatedUnitValue ?? 0);
    finishedGoods.linkedProductionRef = `${req.body?.linkedProductionRef ?? finishedGoods.linkedProductionRef ?? ""}`.trim();
    finishedGoods.note = `${req.body?.note ?? finishedGoods.note ?? ""}`.trim();
    finishedGoods.updatedBy = req.user._id;

    if (!finishedGoods.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }
    if (!Number.isFinite(finishedGoods.qtyReady) || finishedGoods.qtyReady <= 0) {
      return res.status(400).json({ success: false, message: "Ready quantity must be greater than 0" });
    }
    if (!Number.isFinite(finishedGoods.estimatedUnitValue) || finishedGoods.estimatedUnitValue < 0) {
      return res.status(400).json({ success: false, message: "Estimated unit value must be 0 or greater" });
    }

    await finishedGoods.save();

    return res.json({ success: true, message: "Finished goods entry updated", finishedGoods });
  } catch (error) {
    console.error("Update Finished Goods Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update finished goods entry" });
  }
};

exports.deleteFinishedGoods = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete entries" });
    }

    const finishedGoods = await FinishedGoodsRegister.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!finishedGoods) {
      return res.status(404).json({ success: false, message: "Finished goods entry not found" });
    }

    return res.json({ success: true, message: "Finished goods entry deleted" });
  } catch (error) {
    console.error("Delete Finished Goods Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete finished goods entry" });
  }
};
