const FactoryProduction = require("../models/FactoryProduction");
const FactoryProduct = require("../models/FactoryProduct");
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

const normalizeOptionalDate = (raw) => {
  if (raw === undefined || raw === null || `${raw}`.trim() === "") {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeMaterialLines = async (req, lines = []) => {
  const normalized = [];

  for (const line of lines || []) {
    const qtyUsed = toNumber(line?.qtyUsed);
    const rate = toNumber(line?.rate);
    const amount = toNumber(line?.amount);
    const rawMaterialId = `${line?.rawMaterial || ""}`.trim();

    if (!rawMaterialId && !`${line?.materialName || ""}`.trim()) {
      continue;
    }

    if (!Number.isFinite(qtyUsed) || qtyUsed <= 0) {
      throw new Error("Material line quantity must be greater than 0");
    }

    let materialName = `${line?.materialName || ""}`.trim();
    let unitLabel = `${line?.unitLabel || "PCS"}`.trim().toUpperCase();
    let rawMaterial = null;

    if (rawMaterialId) {
      const rawMaterialDoc = await RawMaterial.findOne({
        _id: rawMaterialId,
        shop: req.shopId,
        isDeleted: false,
      }).lean();

      if (!rawMaterialDoc) {
        throw new Error("Selected raw material not found");
      }

      rawMaterial = rawMaterialDoc._id;
      materialName = materialName || rawMaterialDoc.name;
      unitLabel = unitLabel || rawMaterialDoc.unitLabel || "PCS";
    }

    const finalRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
    const finalAmount = Number.isFinite(amount) && amount >= 0 ? amount : qtyUsed * finalRate;

    normalized.push({
      rawMaterial,
      materialName,
      qtyUsed,
      unitLabel,
      rate: finalRate,
      amount: finalAmount,
    });
  }

  return normalized;
};

exports.createProduction = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const entryDate = normalizeDate(req.body?.entryDate);
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const productId = `${req.body?.productRef || ""}`.trim();
    let productDoc = null;
    if (productId) {
      productDoc = await FactoryProduct.findOne({ _id: productId, shop: req.shopId, isDeleted: false }).lean();
      if (!productDoc) {
        return res.status(400).json({ success: false, message: "Selected factory product not found" });
      }
    }

    const materialLines = await normalizeMaterialLines(req, req.body?.materialLines || []);
    const materialCostFromLines = materialLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

    const payload = {
      shop: req.shopId,
      entryDate,
      serialNo: `${req.body?.serialNo || ""}`.trim(),
      productRef: productDoc?._id || null,
      itemName: `${req.body?.itemName || productDoc?.name || ""}`.trim(),
      itemDescription: `${req.body?.itemDescription || ""}`.trim(),
      rawMaterialDetails: materialLines.length > 0
        ? materialLines.map((line) => `${line.materialName} ${line.qtyUsed} ${line.unitLabel}`).join(", ")
        : `${req.body?.rawMaterialDetails || ""}`.trim(),
      materialLines,
      materialCost: materialLines.length > 0 ? materialCostFromLines : toNumber(req.body?.materialCost),
      labourCost: toNumber(req.body?.labourCost),
      otherCost: toNumber(req.body?.otherCost),
      qtyProduced: toNumber(req.body?.qtyProduced),
      unitLabel: `${req.body?.unitLabel || productDoc?.unitLabel || "PCS"}`.trim().toUpperCase(),
      wasteQty: toNumber(req.body?.wasteQty),
      workersInvolved: `${req.body?.workersInvolved || ""}`.trim(),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    };

    if (!payload.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const numericFields = ["materialCost", "labourCost", "otherCost", "qtyProduced", "wasteQty"];
    for (const field of numericFields) {
      if (!Number.isFinite(payload[field]) || payload[field] < 0) {
        return res.status(400).json({ success: false, message: `${field} must be 0 or greater` });
      }
    }

    if (payload.qtyProduced <= 0) {
      return res.status(400).json({ success: false, message: "Quantity produced must be greater than 0" });
    }

    const production = await FactoryProduction.create(payload);
    const populated = await FactoryProduction.findById(production._id)
      .populate("createdBy", "email role pFname pLname")
      .populate("productRef", "name code unitLabel")
      .populate("materialLines.rawMaterial", "name code unitLabel currentRate");

    return res.status(201).json({ success: true, message: "Production entry added", production: populated });
  } catch (error) {
    console.error("Create Factory Production Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create production entry" });
  }
};

exports.getProductions = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = { shop: req.shopId, isDeleted: false };

    if (STAFF_ONLY_FILTER(req)) {
      filter.createdBy = req.user._id;
    }

    const { search, dateFrom, dateTo } = req.query || {};
    const from = normalizeOptionalDate(dateFrom);
    const to = normalizeOptionalDate(dateTo);

    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = startOfDay(from);
      if (to) filter.entryDate.$lte = endOfDay(to);
    }

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [
        { serialNo: regex },
        { itemName: regex },
        { itemDescription: regex },
        { rawMaterialDetails: regex },
        { "materialLines.materialName": regex },
        { workersInvolved: regex },
        { note: regex },
      ];
    }

    const productions = await FactoryProduction.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname")
      .populate("productRef", "name code unitLabel")
      .populate("materialLines.rawMaterial", "name code unitLabel currentRate");

    return res.json({ success: true, productions });
  } catch (error) {
    console.error("Get Factory Productions Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch production entries" });
  }
};

exports.getProductionSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = { shop: req.shopId, isDeleted: false };
    if (STAFF_ONLY_FILTER(req)) {
      baseMatch.createdBy = req.user._id;
    }

    const [totals, today, byItem] = await Promise.all([
      FactoryProduction.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalQty: { $sum: "$qtyProduced" },
            totalMaterialCost: { $sum: "$materialCost" },
            totalLabourCost: { $sum: "$labourCost" },
            totalOtherCost: { $sum: "$otherCost" },
          },
        },
      ]),
      FactoryProduction.aggregate([
        { $match: { ...baseMatch, entryDate: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) } } },
        { $group: { _id: null, todayQty: { $sum: "$qtyProduced" }, todayEntries: { $sum: 1 } } },
      ]),
      FactoryProduction.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$itemName",
            qtyProduced: { $sum: "$qtyProduced" },
            totalCost: { $sum: { $add: ["$materialCost", "$labourCost", "$otherCost"] } },
          },
        },
        { $sort: { qtyProduced: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const totalMaterialCost = Number(totals?.[0]?.totalMaterialCost || 0);
    const totalLabourCost = Number(totals?.[0]?.totalLabourCost || 0);
    const totalOtherCost = Number(totals?.[0]?.totalOtherCost || 0);

    return res.json({
      success: true,
      summary: {
        totalEntries: Number(totals?.[0]?.totalEntries || 0),
        totalQty: Number(totals?.[0]?.totalQty || 0),
        totalCost: totalMaterialCost + totalLabourCost + totalOtherCost,
        totalMaterialCost,
        totalLabourCost,
        totalOtherCost,
        todayQty: Number(today?.[0]?.todayQty || 0),
        todayEntries: Number(today?.[0]?.todayEntries || 0),
        byItem,
      },
    });
  } catch (error) {
    console.error("Factory Production Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch production summary" });
  }
};

exports.updateProduction = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update entries" });
    }

    const production = await FactoryProduction.findOne({ _id: req.params.id, shop: req.shopId, isDeleted: false });
    if (!production) {
      return res.status(404).json({ success: false, message: "Production entry not found" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : production.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const productId = req.body?.productRef !== undefined ? `${req.body?.productRef || ""}`.trim() : `${production.productRef || ""}`.trim();
    let productDoc = null;
    if (productId) {
      productDoc = await FactoryProduct.findOne({ _id: productId, shop: req.shopId, isDeleted: false }).lean();
      if (!productDoc) {
        return res.status(400).json({ success: false, message: "Selected factory product not found" });
      }
    }

    const incomingLines = req.body?.materialLines !== undefined ? req.body.materialLines : production.materialLines;
    const materialLines = await normalizeMaterialLines(req, incomingLines || []);
    const materialCostFromLines = materialLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);

    production.entryDate = entryDate;
    production.serialNo = `${req.body?.serialNo ?? production.serialNo ?? ""}`.trim();
    production.productRef = productDoc?._id || null;
    production.itemName = `${req.body?.itemName || productDoc?.name || production.itemName || ""}`.trim();
    production.itemDescription = `${req.body?.itemDescription ?? production.itemDescription ?? ""}`.trim();
    production.materialLines = materialLines;
    production.rawMaterialDetails = materialLines.length > 0
      ? materialLines.map((line) => `${line.materialName} ${line.qtyUsed} ${line.unitLabel}`).join(", ")
      : `${req.body?.rawMaterialDetails ?? production.rawMaterialDetails ?? ""}`.trim();
    production.materialCost = materialLines.length > 0 ? materialCostFromLines : toNumber(req.body?.materialCost ?? production.materialCost);
    production.labourCost = toNumber(req.body?.labourCost ?? production.labourCost);
    production.otherCost = toNumber(req.body?.otherCost ?? production.otherCost);
    production.qtyProduced = toNumber(req.body?.qtyProduced ?? production.qtyProduced);
    production.unitLabel = `${req.body?.unitLabel || productDoc?.unitLabel || production.unitLabel || "PCS"}`.trim().toUpperCase();
    production.wasteQty = toNumber(req.body?.wasteQty ?? production.wasteQty);
    production.workersInvolved = `${req.body?.workersInvolved ?? production.workersInvolved ?? ""}`.trim();
    production.note = `${req.body?.note ?? production.note ?? ""}`.trim();
    production.updatedBy = req.user._id;

    if (!production.itemName) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const numericFields = ["materialCost", "labourCost", "otherCost", "qtyProduced", "wasteQty"];
    for (const field of numericFields) {
      if (!Number.isFinite(production[field]) || production[field] < 0) {
        return res.status(400).json({ success: false, message: `${field} must be 0 or greater` });
      }
    }

    if (production.qtyProduced <= 0) {
      return res.status(400).json({ success: false, message: "Quantity produced must be greater than 0" });
    }

    await production.save();

    const populated = await FactoryProduction.findById(production._id)
      .populate("createdBy", "email role pFname pLname")
      .populate("productRef", "name code unitLabel")
      .populate("materialLines.rawMaterial", "name code unitLabel currentRate");

    return res.json({ success: true, message: "Production entry updated", production: populated });
  } catch (error) {
    console.error("Update Factory Production Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update production entry" });
  }
};

exports.deleteProduction = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete entries" });
    }

    const production = await FactoryProduction.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!production) {
      return res.status(404).json({ success: false, message: "Production entry not found" });
    }

    return res.json({ success: true, message: "Production entry deleted" });
  } catch (error) {
    console.error("Delete Factory Production Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete production entry" });
  }
};
