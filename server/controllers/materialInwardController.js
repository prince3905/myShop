const MaterialInward = require("../models/MaterialInward");
const RawMaterial = require("../models/RawMaterial");

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

const toUpperTrim = (value, fallback = "") => `${value || fallback}`.trim().toUpperCase();

async function resolveMaterial(req, rawMaterialId) {
  if (!rawMaterialId) return null;
  return RawMaterial.findOne({
    _id: rawMaterialId,
    shop: req.shopId,
    isDeleted: false,
  });
}

exports.createMaterialInward = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const entryDate = normalizeDate(req.body?.entryDate);
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const material = await resolveMaterial(req, req.body?.rawMaterial);
    if (!material) {
      return res.status(400).json({ success: false, message: "Valid raw material is required" });
    }

    const qty = Number(req.body?.qty || 0);
    const rate = Number(req.body?.rate || 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ success: false, message: "Rate must be 0 or greater" });
    }

    const inward = await MaterialInward.create({
      shop: req.shopId,
      entryDate,
      rawMaterial: material._id,
      materialName: material.name,
      unitLabel: toUpperTrim(req.body?.unitLabel, material.unitLabel || "PCS"),
      supplierName: `${req.body?.supplierName || material.supplierName || ""}`.trim(),
      invoiceNo: `${req.body?.invoiceNo || ""}`.trim(),
      qty,
      rate,
      paymentMethod: toUpperTrim(req.body?.paymentMethod, "CASH"),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    });

    const populated = await MaterialInward.findById(inward._id)
      .populate("createdBy", "email role pFname pLname")
      .populate("rawMaterial", "name code unitLabel");

    return res.status(201).json({
      success: true,
      message: "Material inward entry added",
      inward: populated,
    });
  } catch (error) {
    console.error("Create Material Inward Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create material inward entry" });
  }
};

exports.getMaterialInwards = async (req, res) => {
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

    const { search, dateFrom, dateTo, rawMaterial } = req.query || {};
    if (`${rawMaterial || ""}`.trim()) {
      filter.rawMaterial = rawMaterial;
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
        { materialName: regex },
        { supplierName: regex },
        { invoiceNo: regex },
        { note: regex },
      ];
    }

    const inwards = await MaterialInward.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname")
      .populate("rawMaterial", "name code unitLabel");

    return res.json({ success: true, inwards });
  } catch (error) {
    console.error("Get Material Inwards Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch material inward entries" });
  }
};

exports.getMaterialInwardSummary = async (req, res) => {
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

    const [totals, today, byMaterial] = await Promise.all([
      MaterialInward.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQty: { $sum: "$qty" },
            totalValue: { $sum: { $multiply: ["$qty", "$rate"] } },
          },
        },
      ]),
      MaterialInward.aggregate([
        { $match: { ...baseMatch, entryDate: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } } },
        {
          $group: {
            _id: null,
            todayQty: { $sum: "$qty" },
            todayEntries: { $sum: 1 },
            todayValue: { $sum: { $multiply: ["$qty", "$rate"] } },
          },
        },
      ]),
      MaterialInward.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$materialName",
            totalQty: { $sum: "$qty" },
            totalValue: { $sum: { $multiply: ["$qty", "$rate"] } },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
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
        todayValue: Number(today?.[0]?.todayValue || 0),
        byMaterial,
      },
    });
  } catch (error) {
    console.error("Material Inward Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch material inward summary" });
  }
};

exports.updateMaterialInward = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update inward entries" });
    }

    const inward = await MaterialInward.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!inward) {
      return res.status(404).json({ success: false, message: "Material inward entry not found" });
    }

    const material = await resolveMaterial(req, req.body?.rawMaterial || inward.rawMaterial);
    if (!material) {
      return res.status(400).json({ success: false, message: "Valid raw material is required" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : inward.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    inward.entryDate = entryDate;
    inward.rawMaterial = material._id;
    inward.materialName = material.name;
    inward.unitLabel = toUpperTrim(req.body?.unitLabel, material.unitLabel || inward.unitLabel || "PCS");
    inward.supplierName = `${req.body?.supplierName ?? inward.supplierName ?? material.supplierName ?? ""}`.trim();
    inward.invoiceNo = `${req.body?.invoiceNo ?? inward.invoiceNo ?? ""}`.trim();
    inward.qty = Number(req.body?.qty ?? inward.qty ?? 0);
    inward.rate = Number(req.body?.rate ?? inward.rate ?? 0);
    inward.paymentMethod = toUpperTrim(req.body?.paymentMethod, inward.paymentMethod || "CASH");
    inward.note = `${req.body?.note ?? inward.note ?? ""}`.trim();
    inward.updatedBy = req.user._id;

    if (!Number.isFinite(inward.qty) || inward.qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    if (!Number.isFinite(inward.rate) || inward.rate < 0) {
      return res.status(400).json({ success: false, message: "Rate must be 0 or greater" });
    }

    await inward.save();

    return res.json({ success: true, message: "Material inward entry updated", inward });
  } catch (error) {
    console.error("Update Material Inward Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update material inward entry" });
  }
};

exports.deleteMaterialInward = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete inward entries" });
    }

    const inward = await MaterialInward.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!inward) {
      return res.status(404).json({ success: false, message: "Material inward entry not found" });
    }

    return res.json({ success: true, message: "Material inward entry deleted" });
  } catch (error) {
    console.error("Delete Material Inward Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete material inward entry" });
  }
};
