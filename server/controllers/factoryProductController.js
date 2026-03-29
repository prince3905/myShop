const FactoryProduct = require("../models/FactoryProduct");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const ProductVariation = require("../models/ProductVariation");
const RawMaterial = require("../models/RawMaterial");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const toObjectIdOrNull = (value) => {
  const normalized = `${value || ""}`.trim();
  return normalized || null;
};

const populateFactoryProduct = (query) =>
  query
    .populate("createdBy", "email role pFname pLname")
    .populate("updatedBy", "email role pFname pLname")
    .populate("shopCategory", "name")
    .populate("shopBrand", "name")
    .populate("shopProduct", "name slug category brand")
    .populate("shopModel", "name product")
    .populate("shopVariation", "sku sellingPrice costPrice attributes product model")
    .populate("standardMaterialLines.rawMaterial", "name code unitLabel currentRate");

const validateShopMapping = async (req, payload = {}) => {
  const mapping = {
    shopCategory: toObjectIdOrNull(payload.shopCategory),
    shopBrand: toObjectIdOrNull(payload.shopBrand),
    shopProduct: toObjectIdOrNull(payload.shopProduct),
    shopModel: toObjectIdOrNull(payload.shopModel),
    shopVariation: toObjectIdOrNull(payload.shopVariation),
    variationColor: `${payload.variationColor || ""}`.trim(),
    variationSize: `${payload.variationSize || ""}`.trim(),
    defaultSellingPrice: toNumber(payload.defaultSellingPrice),
  };

  if (!Number.isFinite(mapping.defaultSellingPrice) || mapping.defaultSellingPrice < 0) {
    return { error: "Default selling price must be 0 or greater" };
  }

  let categoryDoc = null;
  let brandDoc = null;
  let productDoc = null;
  let modelDoc = null;
  let variationDoc = null;

  if (mapping.shopCategory) {
    categoryDoc = await Category.findOne({ _id: mapping.shopCategory, shop: req.shopId });
    if (!categoryDoc) {
      return { error: "Selected category not found for current shop" };
    }
  }

  if (mapping.shopBrand) {
    brandDoc = await Brand.findOne({ _id: mapping.shopBrand, shop: req.shopId });
    if (!brandDoc) {
      return { error: "Selected brand not found for current shop" };
    }
  }

  if (mapping.shopProduct) {
    productDoc = await Product.findOne({
      _id: mapping.shopProduct,
      shop: req.shopId,
      isDeleted: { $ne: true },
    }).select("_id category brand name");

    if (!productDoc) {
      return { error: "Selected shop product not found for current shop" };
    }

    if (mapping.shopCategory && `${productDoc.category || ""}` !== `${mapping.shopCategory}`) {
      return { error: "Selected shop product does not belong to selected category" };
    }

    if (mapping.shopBrand && `${productDoc.brand || ""}` !== `${mapping.shopBrand}`) {
      return { error: "Selected shop product does not belong to selected brand" };
    }
  }

  if (mapping.shopModel) {
    modelDoc = await ProductModel.findOne({
      _id: mapping.shopModel,
      shop: req.shopId,
      isDeleted: { $ne: true },
    }).select("_id product name");

    if (!modelDoc) {
      return { error: "Selected shop model not found for current shop" };
    }

    if (mapping.shopProduct && `${modelDoc.product || ""}` !== `${mapping.shopProduct}`) {
      return { error: "Selected shop model does not belong to selected shop product" };
    }
  }

  if (mapping.shopVariation) {
    variationDoc = await ProductVariation.findOne({
      _id: mapping.shopVariation,
      shop: req.shopId,
    }).select("_id product model sku sellingPrice attributes");

    if (!variationDoc) {
      return { error: "Selected shop variation not found for current shop" };
    }

    if (mapping.shopProduct && `${variationDoc.product || ""}` !== `${mapping.shopProduct}`) {
      return { error: "Selected shop variation does not belong to selected shop product" };
    }

    if (mapping.shopModel && `${variationDoc.model || ""}` !== `${mapping.shopModel}`) {
      return { error: "Selected shop variation does not belong to selected shop model" };
    }

    mapping.shopProduct = mapping.shopProduct || `${variationDoc.product}`;
    mapping.shopModel = mapping.shopModel || `${variationDoc.model}`;
    mapping.variationColor = mapping.variationColor || `${variationDoc.attributes?.color || ""}`.trim();
    mapping.variationSize = mapping.variationSize || `${variationDoc.attributes?.size || ""}`.trim();
    mapping.defaultSellingPrice =
      Number.isFinite(mapping.defaultSellingPrice) && mapping.defaultSellingPrice > 0
        ? mapping.defaultSellingPrice
        : Number(variationDoc.sellingPrice || 0);
  }

  return {
    mapping: {
      ...mapping,
      shopCategory: categoryDoc?._id || mapping.shopCategory,
      shopBrand: brandDoc?._id || mapping.shopBrand,
      shopProduct: productDoc?._id || mapping.shopProduct,
      shopModel: modelDoc?._id || mapping.shopModel,
      shopVariation: variationDoc?._id || mapping.shopVariation,
    },
  };
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
      shopCategory: null,
      shopBrand: null,
      shopProduct: null,
      shopModel: null,
      shopVariation: null,
      variationColor: "",
      variationSize: "",
      defaultSellingPrice: 0,
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

    const validatedMapping = await validateShopMapping(req, req.body || {});
    if (validatedMapping.error) {
      return res.status(400).json({ success: false, message: validatedMapping.error });
    }
    Object.assign(payload, validatedMapping.mapping);

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
    const populated = await populateFactoryProduct(FactoryProduct.findById(product._id));

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

    const products = await populateFactoryProduct(
      FactoryProduct.find(filter).sort({ active: -1, name: 1, createdAt: -1 }),
    );

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

    const validatedMapping = await validateShopMapping(req, {
      shopCategory: req.body?.shopCategory ?? product.shopCategory,
      shopBrand: req.body?.shopBrand ?? product.shopBrand,
      shopProduct: req.body?.shopProduct ?? product.shopProduct,
      shopModel: req.body?.shopModel ?? product.shopModel,
      shopVariation: req.body?.shopVariation ?? product.shopVariation,
      variationColor: req.body?.variationColor ?? product.variationColor,
      variationSize: req.body?.variationSize ?? product.variationSize,
      defaultSellingPrice: req.body?.defaultSellingPrice ?? product.defaultSellingPrice,
    });
    if (validatedMapping.error) {
      return res.status(400).json({ success: false, message: validatedMapping.error });
    }

    product.shopCategory = validatedMapping.mapping.shopCategory;
    product.shopBrand = validatedMapping.mapping.shopBrand;
    product.shopProduct = validatedMapping.mapping.shopProduct;
    product.shopModel = validatedMapping.mapping.shopModel;
    product.shopVariation = validatedMapping.mapping.shopVariation;
    product.variationColor = validatedMapping.mapping.variationColor;
    product.variationSize = validatedMapping.mapping.variationSize;
    product.defaultSellingPrice = validatedMapping.mapping.defaultSellingPrice;

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
    const populated = await populateFactoryProduct(FactoryProduct.findById(product._id));
    return res.json({ success: true, message: "Factory product updated", product: populated });
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
