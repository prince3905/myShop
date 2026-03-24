const FactoryProduct = require("../models/FactoryProduct");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : NaN;
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
      standardLabourCost: toNumber(req.body?.standardLabourCost),
      standardOtherCost: toNumber(req.body?.standardOtherCost),
      note: `${req.body?.note || ""}`.trim(),
      active: req.body?.active !== false,
      createdBy: req.user._id,
    };

    if (!payload.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!Number.isFinite(payload.standardLabourCost) || payload.standardLabourCost < 0) {
      return res.status(400).json({ success: false, message: "Standard labour cost must be 0 or greater" });
    }

    if (!Number.isFinite(payload.standardOtherCost) || payload.standardOtherCost < 0) {
      return res.status(400).json({ success: false, message: "Standard other cost must be 0 or greater" });
    }

    const product = await FactoryProduct.create(payload);
    const populated = await FactoryProduct.findById(product._id).populate("createdBy", "email role pFname pLname");

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
      .populate("createdBy", "email role pFname pLname");

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
    product.standardLabourCost = toNumber(req.body?.standardLabourCost ?? product.standardLabourCost);
    product.standardOtherCost = toNumber(req.body?.standardOtherCost ?? product.standardOtherCost);
    product.note = `${req.body?.note ?? product.note ?? ""}`.trim();
    product.active = req.body?.active !== undefined ? !!req.body.active : product.active;
    product.updatedBy = req.user._id;

    if (!product.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    if (!Number.isFinite(product.standardLabourCost) || product.standardLabourCost < 0) {
      return res.status(400).json({ success: false, message: "Standard labour cost must be 0 or greater" });
    }

    if (!Number.isFinite(product.standardOtherCost) || product.standardOtherCost < 0) {
      return res.status(400).json({ success: false, message: "Standard other cost must be 0 or greater" });
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
