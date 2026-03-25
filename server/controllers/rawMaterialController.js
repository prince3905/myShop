const RawMaterial = require("../models/RawMaterial");
const StaffDailyWork = require("../models/StaffDailyWork");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const objectIds = (materials) => materials.map((item) => item._id);

const buildMovementMatch = (req, extra = {}) => {
  const match = {
    shop: req.shopId,
    isDeleted: false,
    ...extra,
  };

  if (STAFF_ONLY_FILTER(req)) {
    match.createdBy = req.user._id;
  }

  return match;
};

const attachStockMetrics = async (req, materials) => {
  if (!materials.length) {
    return [];
  }

  const ids = objectIds(materials);

  const [dailyWorks] = await Promise.all([
    StaffDailyWork.find(
      buildMovementMatch(req, {
        factoryProduct: { $ne: null },
        attendanceStatus: { $ne: "ABSENT" },
        unitsCompleted: { $gt: 0 },
      }),
    )
      .select("factoryProduct unitsCompleted")
      .populate("factoryProduct", "standardMaterialLines")
      .lean(),
  ]);

  const consumedMap = new Map();

  for (const row of dailyWorks || []) {
    const unitsCompleted = Number(row?.unitsCompleted || 0);
    if (unitsCompleted <= 0) {
      continue;
    }
    for (const line of row?.factoryProduct?.standardMaterialLines || []) {
      const rawMaterialId = line?.rawMaterial ? String(line.rawMaterial) : "";
      if (!rawMaterialId || !ids.some((id) => String(id) === rawMaterialId)) {
        continue;
      }
      const qtyPerUnit = Number(line?.qtyPerUnit || 0);
      const rate = Number(line?.rate || 0);
      const consumedQty = qtyPerUnit * unitsCompleted;
      const existing = consumedMap.get(rawMaterialId) || { consumedQty: 0, consumedValue: 0 };
      existing.consumedQty = Number(existing.consumedQty || 0) + consumedQty;
      existing.consumedValue = Number(existing.consumedValue || 0) + (consumedQty * rate);
      consumedMap.set(rawMaterialId, existing);
    }
  }

  return materials.map((material) => {
    const key = String(material._id);
    const consumed = consumedMap.get(key) || {};
    const openingQty = Number(material.openingQty || 0);
    const currentRate = Number(material.currentRate || 0);
    const consumedQty = Number(consumed.consumedQty || 0);
    const currentBalanceQty = openingQty - consumedQty;

    return {
      ...material,
      openingValue: openingQty * currentRate,
      consumedQty,
      consumedValue: Number(consumed.consumedValue || 0),
      currentBalanceQty,
      currentBalanceValue: currentBalanceQty * currentRate,
    };
  });
};

exports.createRawMaterial = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const payload = {
      shop: req.shopId,
      name: `${req.body?.name || ""}`.trim(),
      code: `${req.body?.code || ""}`.trim(),
      unitLabel: `${req.body?.unitLabel || "PCS"}`.trim().toUpperCase(),
      openingQty: Number(req.body?.openingQty || 0),
      currentRate: Number(req.body?.currentRate || 0),
      supplierName: `${req.body?.supplierName || ""}`.trim(),
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    };

    if (!payload.name) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }

    if (!Number.isFinite(payload.openingQty) || payload.openingQty < 0) {
      return res.status(400).json({ success: false, message: "Opening quantity must be 0 or greater" });
    }

    if (!Number.isFinite(payload.currentRate) || payload.currentRate < 0) {
      return res.status(400).json({ success: false, message: "Current rate must be 0 or greater" });
    }

    const material = await RawMaterial.create(payload);
    const populated = await RawMaterial.findById(material._id).populate("createdBy", "email role pFname pLname");

    return res.status(201).json({
      success: true,
      message: "Raw material added",
      material: populated,
    });
  } catch (error) {
    console.error("Create Raw Material Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create raw material" });
  }
};

exports.getRawMaterials = async (req, res) => {
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

    const { search, active } = req.query || {};
    if (`${active || ""}`.trim()) {
      filter.active = `${active}`.trim() === "true";
    }
    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [
        { name: regex },
        { code: regex },
        { supplierName: regex },
        { note: regex },
      ];
    }

    const materials = await RawMaterial.find(filter)
      .sort({ active: -1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname")
      .lean();

    const materialsWithMetrics = await attachStockMetrics(req, materials);

    return res.json({ success: true, materials: materialsWithMetrics });
  } catch (error) {
    console.error("Get Raw Materials Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch raw materials" });
  }
};

exports.getRawMaterialSummary = async (req, res) => {
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

    const [materials, activeCount] = await Promise.all([
      RawMaterial.find(baseMatch).lean(),
      RawMaterial.countDocuments({ ...baseMatch, active: true }),
    ]);

    const materialsWithMetrics = await attachStockMetrics(req, materials);

    const summary = materialsWithMetrics.reduce((acc, item) => {
      acc.totalMaterials += 1;
      acc.totalOpeningQty += Number(item.openingQty || 0);
      acc.totalOpeningValue += Number(item.openingValue || 0);
      acc.totalConsumedQty += Number(item.consumedQty || 0);
      acc.totalConsumedValue += Number(item.consumedValue || 0);
      acc.currentBalanceQty += Number(item.currentBalanceQty || 0);
      acc.currentBalanceValue += Number(item.currentBalanceValue || 0);
      return acc;
    }, {
      totalMaterials: 0,
      totalOpeningQty: 0,
      totalOpeningValue: 0,
      totalConsumedQty: 0,
      totalConsumedValue: 0,
      currentBalanceQty: 0,
      currentBalanceValue: 0,
    });

    return res.json({
      success: true,
      summary: {
        totalMaterials: Number(summary.totalMaterials || 0),
        activeMaterials: Number(activeCount || 0),
        inactiveMaterials: Number((summary.totalMaterials || 0) - activeCount || 0),
        totalOpeningQty: Number(summary.totalOpeningQty || 0),
        totalOpeningValue: Number(summary.totalOpeningValue || 0),
        totalConsumedQty: Number(summary.totalConsumedQty || 0),
        totalConsumedValue: Number(summary.totalConsumedValue || 0),
        currentBalanceQty: Number(summary.currentBalanceQty || 0),
        currentBalanceValue: Number(summary.currentBalanceValue || 0),
      },
    });
  } catch (error) {
    console.error("Raw Material Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch raw material summary" });
  }
};

exports.updateRawMaterial = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update materials" });
    }

    const material = await RawMaterial.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!material) {
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }

    material.name = `${req.body?.name || material.name || ""}`.trim();
    material.code = `${req.body?.code ?? material.code ?? ""}`.trim();
    material.unitLabel = `${req.body?.unitLabel || material.unitLabel || "PCS"}`.trim().toUpperCase();
    material.openingQty = Number(req.body?.openingQty ?? material.openingQty ?? 0);
    material.currentRate = Number(req.body?.currentRate ?? material.currentRate ?? 0);
    material.supplierName = `${req.body?.supplierName ?? material.supplierName ?? ""}`.trim();
    material.note = `${req.body?.note ?? material.note ?? ""}`.trim();
    material.active = req.body?.active !== undefined ? !!req.body.active : material.active;
    material.updatedBy = req.user._id;

    if (!material.name) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }

    if (!Number.isFinite(material.openingQty) || material.openingQty < 0) {
      return res.status(400).json({ success: false, message: "Opening quantity must be 0 or greater" });
    }

    if (!Number.isFinite(material.currentRate) || material.currentRate < 0) {
      return res.status(400).json({ success: false, message: "Current rate must be 0 or greater" });
    }

    await material.save();

    return res.json({ success: true, message: "Raw material updated", material });
  } catch (error) {
    console.error("Update Raw Material Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update raw material" });
  }
};

exports.deleteRawMaterial = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete materials" });
    }

    const material = await RawMaterial.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!material) {
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }

    return res.json({ success: true, message: "Raw material deleted" });
  } catch (error) {
    console.error("Delete Raw Material Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete raw material" });
  }
};
