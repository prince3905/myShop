const Distributor = require("../models/Distributor");
const Shop = require("../models/Shop");
const {
  createDistributorLedgerEntry,
} = require("../utils/distributorLedger.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const normalizeDistributorPayload = (body = {}, { includeOpeningBalance = false } = {}) => {
  const payload = {
    name: `${body.name || ""}`.trim(),
    shopName: `${body.shopName || ""}`.trim() || undefined,
    email: `${body.email || ""}`.trim().toLowerCase() || undefined,
    phone: `${body.phone || ""}`.trim(),
    telephone: `${body.telephone || ""}`.trim() || undefined,
    gstNumber: `${body.gstNumber || ""}`.trim() || undefined,
    creditLimit: Math.max(0, Number(body.creditLimit || 0)),
    paymentTerms: Math.max(0, Number(body.paymentTerms || 0)),
    address: body.address || {},
  };

  if (includeOpeningBalance) {
    payload.openingBalance = Math.max(0, Number(body.openingBalance || 0));
  }

  return payload;
};

exports.allDistributors = async (req, res) => {
  try {
    const { name, phone, page = 1, perPage = 10 } = req.query;

    let query = isSuperAdminGlobal(req)
      ? { isDeleted: { $ne: true } }
      : { shop: req.shopId, isDeleted: { $ne: true } };

    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    if (phone) {
      query.phone = { $regex: phone, $options: "i" };
    }

    const limit = parseInt(perPage) || 10;
    const skip = (parseInt(page) - 1) * limit;

    const totalItems = await Distributor.countDocuments(query);

    const distributors = await Distributor.find(query)
      .populate("shop", "name shopCode")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      distributors,
      totalItems,
    });
  } catch (err) {
    console.error("Error retrieving distributors:", err);
    res.status(500).json({ error: "Error retrieving distributors" });
  }
};

exports.addDistributor = async (req, res) => {
  try {
    let targetShopId = req.shopId;

    if (!targetShopId && req.user?.role === "SUPER_ADMIN" && req.body?.shop) {
      const requestedShop = await Shop.findOne({
        _id: req.body.shop,
        isActive: true,
      });

      if (!requestedShop) {
        return res.status(404).json({
          success: false,
          message: "Selected shop not found",
        });
      }

      targetShopId = requestedShop._id;
    }

    if (!targetShopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const payload = normalizeDistributorPayload(req.body, {
      includeOpeningBalance: true,
    });

    const distributor = new Distributor({
      ...payload,
      shop: targetShopId,
      currentBalance: 0, // IMPORTANT
    });

    const savedDistributor = await distributor.save();

    const openingAmount = Number(payload.openingBalance) || 0;

    if (openingAmount > 0) {
      await createDistributorLedgerEntry({
        shop: targetShopId,
        distributor: savedDistributor._id,
        type: "opening",
        amount: openingAmount,
        note: "Opening Balance",
        createdBy: req.user._id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Distributor added successfully",
      distributor: savedDistributor,
    });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Distributor phone already exists in this shop",
      });
    }
    res.status(500).json({ error: "Error saving distributor" });
  }
};

exports.getDistributorDetails = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req)
      ? { _id: req.params.id }
      : { _id: req.params.id, shop: req.shopId };

    const distributor = await Distributor.findOne(query);

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    res.status(200).json(distributor);
  } catch (err) {
    res.status(500).json({ error: "Error retrieving distributor details" });
  }
};

exports.updateDistributor = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const distributorId = req.params.id;

    const updateData = {
      ...normalizeDistributorPayload(req.body),
    };

    const updatedDistributor = await Distributor.findOneAndUpdate(
      { _id: distributorId, shop: req.shopId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedDistributor) {
      return res.status(404).json({ message: "Distributor not found" });
    }

    res.json({
      success: true,
      distributor: updatedDistributor,
    });
  } catch (error) {
    console.error("Update Distributor Error:", error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Distributor phone already exists in this shop",
      });
    }
    res.status(500).json({ message: "Error updating distributor" });
  }
};

exports.deleteDistributor = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const deleted = await Distributor.findOneAndDelete({
      _id: req.params.id,
      shop: req.shopId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    res.json({
      success: true,
      message: "Distributor deleted",
    });
  } catch (err) {
    res.status(500).json({ error: "Error deleting distributor" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "disabled", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const distributor = await Distributor.findOneAndUpdate(
      { _id: id, shop: req.shopId },
      { status: status },
      { new: true }
    );

    if (!distributor) {
      return res.status(404).json({
        success: false,
        message: "Distributor not found",
      });
    }

    return res.json({
      success: true,
      message: "Status updated successfully",
      data: { id: distributor._id, status: distributor.status },
    });

  } catch (err) {
    console.error("updateStatus error", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.distributorSuggestions = async (req, res) => {
  try {
    const { term } = req.query;

    let query = {
      name: { $regex: term, $options: "i" },
      isDeleted: { $ne: true },
    };
    if (!isSuperAdminGlobal(req)) {
      query.shop = req.shopId;
    }

    const results = await Distributor.find(query)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("name");

    res.json(results.map((d) => d.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error searching distributor" });
  }
};
