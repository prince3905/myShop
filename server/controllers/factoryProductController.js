const FactoryProduct = require("../models/FactoryProduct");
const RawMaterial = require("../models/RawMaterial");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeMaterialLines = async (req, lines = []) => {
  const normalized = [];

  for (const line of lines || []) {
    const rawMaterialId = `${line?.rawMaterial || ""}`.trim();
    const qtyPerUnit = toNumber(line?.qtyPerUnit);
    const rate = toNumber(line?.rate);

    if (!rawMaterialId && !`${line?.materialName || ""}`.trim()) {
      continue;
    }

    if (!Number.isFinite(qtyPerUnit) || qtyPerUnit <= 0) {
      return { error: "Material qty per unit must be greater than 0" };
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
        return { error: "Selected raw material not found" };
      }

      rawMaterial = rawMaterialDoc._id;
      materialName = materialName || rawMaterialDoc.name;
      unitLabel = unitLabel || rawMaterialDoc.unitLabel || "PCS";
    }

    normalized.push({
      rawMaterial,
      materialName,
      qtyPerUnit,
      unitLabel,
      rate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
    });
  }

  return { lines: normalized };
};

exports.createFactoryProduct = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const payload = {
      shop: req.shopId,
      name: `${req.body?.name || ""}`.trim(),
      code: `${req.body?.code || ""}`.trim(),
      unitLabel: `${req.body?.unitLabel || "PCS"}`.trim().toUpperCase(),
      workerPieceRate: toNumber(req.body?.workerPieceRate),
      standardLabourCost: toNumber(req.body?.standardLabourCost),
      standardOtherCost: toNumber(req.body?.standardOtherCost),
      standardWasteQtyPerUnit: toNumber(req.body?.standardWasteQtyPerUnit),
      standardWasteUnitLabel: `${req.body?.standardWasteUnitLabel || "KG"}`.trim().toUpperCase(),
      standardWasteValuePerUnit: toNumber(req.body?.standardWasteValuePerUnit),
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    };

    const materialLines = await normalizeMaterialLines(req, req.body?.standardMaterialLines || []);
    if (materialLines.error) {
      return res.status(400).json({ success: false, message: materialLines.error });
    }
    payload.standardMaterialLines = materialLines.lines;

    if (!payload.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!Number.isFinite(payload.workerPieceRate) || payload.workerPieceRate < 0) {
      return res.status(400).json({ success: false, message: "Worker piece rate must be 0 or greater" });
    }

    if (!Number.isFinite(payload.standardLabourCost) || payload.standardLabourCost < 0) {
      return res.status(400).json({ success: false, message: "Standard labour cost must be 0 or greater" });
    }

    if (!Number.isFinite(payload.standardOtherCost) || payload.standardOtherCost < 0) {
      return res.status(400).json({ success: false, message: "Standard other cost must be 0 or greater" });
    }

    if (!Number.isFinite(payload.standardWasteQtyPerUnit) || payload.standardWasteQtyPerUnit < 0) {
      return res.status(400).json({ success: false, message: "Standard waste qty must be 0 or greater" });
    }

    if (!Number.isFinite(payload.standardWasteValuePerUnit) || payload.standardWasteValuePerUnit < 0) {
      return res.status(400).json({ success: false, message: "Standard waste value must be 0 or greater" });
    }

    const existingProduct = await FactoryProduct.findOne({
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(payload.name)}$`, "i"),
    }).select("_id name");
    if (existingProduct) {
      return res.status(409).json({ success: false, message: `Factory product "${existingProduct.name}" already exists` });
    }

    const product = await FactoryProduct.create(payload);
    const populated = await FactoryProduct.findById(product._id)
      .populate("createdBy", "email role pFname pLname")
      .populate("standardMaterialLines.rawMaterial", "name code unitLabel currentRate");

    return res.status(201).json({ success: true, message: "Factory product added", product: populated });
  } catch (error) {
    console.error("Create Factory Product Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create factory product" });
  }
};

exports.getFactoryProducts = async (req, res) => {
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

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [{ name: regex }, { code: regex }, { note: regex }];
    }

    if (`${active || ""}` !== "") {
      filter.active = `${active}` === "true";
    }

    const products = await FactoryProduct.find(filter)
      .sort({ active: -1, name: 1, createdAt: -1 })
      .populate("createdBy", "email role pFname pLname")
      .populate("standardMaterialLines.rawMaterial", "name code unitLabel currentRate");

    return res.json({ success: true, products });
  } catch (error) {
    console.error("Get Factory Products Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch factory products" });
  }
};

exports.getFactoryProductSummary = async (req, res) => {
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

    const [totals, byUnit] = await Promise.all([
      FactoryProduct.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: { $cond: [{ $eq: ["$active", true] }, 1, 0] },
            },
            inactiveProducts: {
              $sum: { $cond: [{ $eq: ["$active", false] }, 1, 0] },
            },
          },
        },
      ]),
      FactoryProduct.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$unitLabel", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalProducts: Number(totals?.[0]?.totalProducts || 0),
        activeProducts: Number(totals?.[0]?.activeProducts || 0),
        inactiveProducts: Number(totals?.[0]?.inactiveProducts || 0),
        byUnit,
      },
    });
  } catch (error) {
    console.error("Factory Product Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch factory product summary" });
  }
};

exports.updateFactoryProduct = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to update products" });
    }

    const product = await FactoryProduct.findOne({ _id: req.params.id, shop: req.shopId, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: "Factory product not found" });
    }

    product.name = `${req.body?.name ?? product.name ?? ""}`.trim();
    product.code = `${req.body?.code ?? product.code ?? ""}`.trim();
    product.unitLabel = `${req.body?.unitLabel ?? product.unitLabel ?? "PCS"}`.trim().toUpperCase();
    product.workerPieceRate = toNumber(req.body?.workerPieceRate ?? product.workerPieceRate);
    product.standardLabourCost = toNumber(req.body?.standardLabourCost ?? product.standardLabourCost);
    product.standardOtherCost = toNumber(req.body?.standardOtherCost ?? product.standardOtherCost);
    product.standardWasteQtyPerUnit = toNumber(req.body?.standardWasteQtyPerUnit ?? product.standardWasteQtyPerUnit);
    product.standardWasteUnitLabel = `${req.body?.standardWasteUnitLabel ?? product.standardWasteUnitLabel ?? "KG"}`.trim().toUpperCase();
    product.standardWasteValuePerUnit = toNumber(req.body?.standardWasteValuePerUnit ?? product.standardWasteValuePerUnit);
    product.note = `${req.body?.note ?? product.note ?? ""}`.trim();
    product.active = req.body?.active !== undefined ? !!req.body.active : product.active;
    product.updatedBy = req.user._id;

    const materialLines = await normalizeMaterialLines(req, req.body?.standardMaterialLines ?? product.standardMaterialLines);
    if (materialLines.error) {
      return res.status(400).json({ success: false, message: materialLines.error });
    }
    product.standardMaterialLines = materialLines.lines;

    if (!product.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!Number.isFinite(product.workerPieceRate) || product.workerPieceRate < 0) {
      return res.status(400).json({ success: false, message: "Worker piece rate must be 0 or greater" });
    }

    if (!Number.isFinite(product.standardLabourCost) || product.standardLabourCost < 0) {
      return res.status(400).json({ success: false, message: "Standard labour cost must be 0 or greater" });
    }

    if (!Number.isFinite(product.standardOtherCost) || product.standardOtherCost < 0) {
      return res.status(400).json({ success: false, message: "Standard other cost must be 0 or greater" });
    }

    if (!Number.isFinite(product.standardWasteQtyPerUnit) || product.standardWasteQtyPerUnit < 0) {
      return res.status(400).json({ success: false, message: "Standard waste qty must be 0 or greater" });
    }

    if (!Number.isFinite(product.standardWasteValuePerUnit) || product.standardWasteValuePerUnit < 0) {
      return res.status(400).json({ success: false, message: "Standard waste value must be 0 or greater" });
    }

    const existingProduct = await FactoryProduct.findOne({
      _id: { $ne: product._id },
      shop: req.shopId,
      isDeleted: false,
      name: new RegExp(`^${escapeRegex(product.name)}$`, "i"),
    }).select("_id name");
    if (existingProduct) {
      return res.status(409).json({ success: false, message: `Factory product "${existingProduct.name}" already exists` });
    }

    await product.save();
    return res.json({ success: true, message: "Factory product updated", product });
  } catch (error) {
    console.error("Update Factory Product Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update factory product" });
  }
};

exports.deleteFactoryProduct = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete products" });
    }

    const product = await FactoryProduct.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: req.user._id } },
      { new: true },
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Factory product not found" });
    }

    return res.json({ success: true, message: "Factory product deleted" });
  } catch (error) {
    console.error("Delete Factory Product Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete factory product" });
  }
};
