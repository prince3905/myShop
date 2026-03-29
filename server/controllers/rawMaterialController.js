const RawMaterial = require("../models/RawMaterial");
const RawMaterialPurchase = require("../models/RawMaterialPurchase");
const StaffDailyWork = require("../models/StaffDailyWork");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  const [approvedPurchases, dailyWorks] = await Promise.all([
    RawMaterialPurchase.find(
      buildMovementMatch(req, {
        status: "APPROVED",
      }),
    )
      .select("items")
      .lean(),
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

  const receivedMap = new Map();
  for (const purchase of approvedPurchases || []) {
    for (const item of purchase?.items || []) {
      const rawMaterialId = item?.rawMaterial ? String(item.rawMaterial) : "";
      if (!rawMaterialId || !ids.some((id) => String(id) === rawMaterialId)) {
        continue;
      }
      const receivedQty = Number(item?.receivedQty || 0);
      const rate = Number(item?.rate || 0);
      const existing = receivedMap.get(rawMaterialId) || { receivedQty: 0, receivedValue: 0 };
      existing.receivedQty = Number(existing.receivedQty || 0) + receivedQty;
      existing.receivedValue = Number(existing.receivedValue || 0) + (receivedQty * rate);
      receivedMap.set(rawMaterialId, existing);
    }
  }

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
    const received = receivedMap.get(key) || {};
    const consumed = consumedMap.get(key) || {};
    const currentRate = Number(material.currentRate || 0);
    const receivedQty = Number(received.receivedQty || 0);
    const consumedQty = Number(consumed.consumedQty || 0);
    const currentBalanceQty = receivedQty - consumedQty;

    return {
      ...material,
      receivedQty,
      receivedValue: Number(received.receivedValue || 0),
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
      sizeLabel: `${req.body?.sizeLabel || ""}`.trim(),
      colorLabel: `${req.body?.colorLabel || ""}`.trim(),
      openingQty: 0,
      currentRate: Number(req.body?.currentRate || 0),
      supplierName: "",
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    };

    if (!payload.name) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }

    if (!Number.isFinite(payload.currentRate) || payload.currentRate < 0) {
      return res.status(400).json({ success: false, message: "Current rate must be 0 or greater" });
    }

    const existingMaterial = await RawMaterial.findOne({
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(payload.name)}$`, "i"),
      sizeLabel: new RegExp(`^${escapeRegex(payload.sizeLabel)}$`, "i"),
      colorLabel: new RegExp(`^${escapeRegex(payload.colorLabel)}$`, "i"),
    }).select("_id name sizeLabel colorLabel");
    if (existingMaterial) {
      return res.status(409).json({ success: false, message: "Raw material with same name, size and color already exists" });
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
        { sizeLabel: regex },
        { colorLabel: regex },
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
      acc.totalConsumedQty += Number(item.consumedQty || 0);
      acc.totalConsumedValue += Number(item.consumedValue || 0);
      acc.currentBalanceQty += Number(item.currentBalanceQty || 0);
      acc.currentBalanceValue += Number(item.currentBalanceValue || 0);
      return acc;
    }, {
      totalMaterials: 0,
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

exports.getRawMaterialHistory = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const material = await RawMaterial.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    }).lean();

    if (!material) {
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }

    const [purchases, dailyWorks] = await Promise.all([
      RawMaterialPurchase.find({
        ...buildMovementMatch(req),
        "items.rawMaterial": material._id,
      })
        .sort({ purchaseDate: -1, createdAt: -1 })
        .populate("distributor", "name phone shopName")
        .populate("createdBy", "email role pFname pLname")
        .populate("approvedBy", "email role pFname pLname")
        .lean(),
      StaffDailyWork.find({
        ...buildMovementMatch(req),
        factoryProduct: { $ne: null },
        attendanceStatus: { $ne: "ABSENT" },
        unitsCompleted: { $gt: 0 },
      })
        .sort({ entryDate: -1, createdAt: -1 })
        .select("entryDate staff factoryProduct factoryProductName unitsCompleted unit createdBy")
        .populate("staff", "name phone workType")
        .populate("createdBy", "email role pFname pLname")
        .populate("factoryProduct", "name unitLabel standardWasteQtyPerUnit standardWasteUnitLabel standardWasteValuePerUnit standardMaterialLines")
        .lean(),
    ]);

    const history = [];
    for (const purchase of purchases || []) {
      for (const item of purchase?.items || []) {
        if (`${item?.rawMaterial || ""}` !== `${material._id}`) {
          continue;
        }
        history.push({
          purchaseId: purchase._id,
          invoiceNo: purchase.invoiceNo || "",
          purchaseDate: purchase.purchaseDate,
          distributor: purchase.distributor || null,
          status: purchase.status,
          orderedQty: Number(item?.orderedQty || 0),
          receivedQty: Number(item?.receivedQty || 0),
          sizeLabel: item?.sizeLabel || "",
          colorLabel: item?.colorLabel || "",
          rate: Number(item?.rate || 0),
          totalAmount: Number(item?.totalAmount || 0),
          unitLabel: item?.unitLabel || material.unitLabel || "PCS",
          note: item?.note || purchase?.note || "",
          createdBy: purchase.createdBy || null,
          approvedAt: purchase.approvedAt || null,
          approvedBy: purchase.approvedBy || null,
        });
      }
    }

    const usageHistory = [];
    for (const row of dailyWorks || []) {
      const unitsCompleted = Number(row?.unitsCompleted || 0);
      if (unitsCompleted <= 0) {
        continue;
      }

      for (const line of row?.factoryProduct?.standardMaterialLines || []) {
        if (`${line?.rawMaterial || ""}` !== `${material._id}`) {
          continue;
        }

        const usedQty = Number(line?.qtyPerUnit || 0) * unitsCompleted;
        if (usedQty <= 0) {
          continue;
        }

        usageHistory.push({
          entryDate: row.entryDate,
          staff: row.staff || null,
          factoryProductName: row.factoryProductName || row?.factoryProduct?.name || "",
          unitsCompleted,
          usedQty,
          unitLabel: line?.unitLabel || material.unitLabel || "PCS",
          rate: Number(line?.rate || 0),
          totalValue: usedQty * Number(line?.rate || 0),
          wasteQty:
            Number(row?.factoryProduct?.standardWasteQtyPerUnit || 0) * unitsCompleted,
          wasteUnitLabel: row?.factoryProduct?.standardWasteUnitLabel || "KG",
          wasteValue:
            Number(row?.factoryProduct?.standardWasteValuePerUnit || 0) * unitsCompleted,
          createdBy: row.createdBy || null,
        });
      }
    }

    const summary = history.reduce((acc, row) => {
      acc.purchaseCount += 1;
      acc.totalOrderedQty += Number(row.orderedQty || 0);
      acc.totalReceivedQty += Number(row.receivedQty || 0);
      acc.totalValue += Number(row.totalAmount || 0);
      if (row.rate > 0) {
        acc.lastRate = acc.lastRate || row.rate;
        acc.highestRate = Math.max(acc.highestRate, row.rate);
        acc.lowestRate = acc.lowestRate === 0 ? row.rate : Math.min(acc.lowestRate, row.rate);
      }
      return acc;
    }, {
      purchaseCount: 0,
      totalOrderedQty: 0,
      totalReceivedQty: 0,
      totalValue: 0,
      lastRate: 0,
      highestRate: 0,
      lowestRate: 0,
    });

    const averageRate = summary.totalReceivedQty > 0
      ? summary.totalValue / summary.totalReceivedQty
      : 0;

    const usageSummary = usageHistory.reduce((acc, row) => {
      acc.usageCount += 1;
      acc.totalUsedQty += Number(row.usedQty || 0);
      acc.totalUsedValue += Number(row.totalValue || 0);
      acc.totalWasteQty += Number(row.wasteQty || 0);
      acc.totalWasteValue += Number(row.wasteValue || 0);
      return acc;
    }, {
      usageCount: 0,
      totalUsedQty: 0,
      totalUsedValue: 0,
      totalWasteQty: 0,
      totalWasteValue: 0,
    });

    return res.json({
      success: true,
      material,
      history,
      usageHistory,
      summary: {
        ...summary,
        averageRate,
      },
      usageSummary,
    });
  } catch (error) {
    console.error("Raw Material History Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load raw material history" });
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
    material.sizeLabel = `${req.body?.sizeLabel ?? material.sizeLabel ?? ""}`.trim();
    material.colorLabel = `${req.body?.colorLabel ?? material.colorLabel ?? ""}`.trim();
    material.openingQty = 0;
    material.currentRate = Number(req.body?.currentRate ?? material.currentRate ?? 0);
    material.supplierName = "";
    material.note = `${req.body?.note ?? material.note ?? ""}`.trim();
    material.active = req.body?.active !== undefined ? !!req.body.active : material.active;
    material.updatedBy = req.user._id;

    if (!material.name) {
      return res.status(400).json({ success: false, message: "Material name is required" });
    }

    if (!Number.isFinite(material.currentRate) || material.currentRate < 0) {
      return res.status(400).json({ success: false, message: "Current rate must be 0 or greater" });
    }

    const existingMaterial = await RawMaterial.findOne({
      _id: { $ne: material._id },
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(material.name)}$`, "i"),
      sizeLabel: new RegExp(`^${escapeRegex(material.sizeLabel || "")}$`, "i"),
      colorLabel: new RegExp(`^${escapeRegex(material.colorLabel || "")}$`, "i"),
    }).select("_id");
    if (existingMaterial) {
      return res.status(409).json({ success: false, message: "Raw material with same name, size and color already exists" });
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
