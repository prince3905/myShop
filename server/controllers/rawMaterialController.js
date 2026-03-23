const RawMaterial = require("../models/RawMaterial");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

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
      .populate("createdBy", "email role pFname pLname");

    return res.json({ success: true, materials });
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

    const [totals, activeCount] = await Promise.all([
      RawMaterial.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalMaterials: { $sum: 1 },
            totalOpeningQty: { $sum: "$openingQty" },
            totalValue: { $sum: { $multiply: ["$openingQty", "$currentRate"] } },
          },
        },
      ]),
      RawMaterial.countDocuments({ ...baseMatch, active: true }),
    ]);

    return res.json({
      success: true,
      summary: {
        totalMaterials: Number(totals?.[0]?.totalMaterials || 0),
        activeMaterials: Number(activeCount || 0),
        inactiveMaterials: Number((totals?.[0]?.totalMaterials || 0) - activeCount || 0),
        totalOpeningQty: Number(totals?.[0]?.totalOpeningQty || 0),
        totalValue: Number(totals?.[0]?.totalValue || 0),
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
