const Distributor = require("../models/Distributor");
const Shop = require("../models/Shop");
const {
  createDistributorLedgerEntry,
} = require("../utils/distributorLedger.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

exports.allDistributors = async (req, res) => {
  try {
    const { name, phone, page = 1, perPage = 10 } = req.query;
    console.log("[FLOW][DISTRIBUTOR][LIST] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      query: { name, phone, page, perPage },
    });

    let query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    // 🔍 Search filters
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
      .populate("shop", "name shopCode") // optional but useful
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    console.log("[FLOW][DISTRIBUTOR][LIST] response", {
      count: distributors.length,
      totalItems,
      shopId: req.shopId?.toString(),
    });

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
    console.log("[FLOW][DISTRIBUTOR][CREATE] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      name: req.body?.name,
      phone: req.body?.phone,
      bodyShop: req.body?.shop || null,
    });

    let targetShopId = req.shopId;

    // Super admin in global mode can explicitly pass shop in payload
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

    const distributor = new Distributor({
      ...req.body,
      shop: targetShopId,
      currentBalance: 0, // IMPORTANT
    });

    const savedDistributor = await distributor.save();

    // ✅ Opening Balance Ledger Entry
    const openingAmount = Number(req.body.openingBalance) || 0;

    if (openingAmount > 0) {
      console.log("Creating opening ledger entry...");

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
    res.status(500).json({ error: "Error saving distributor" });
  }
};

exports.getDistributorDetails = async (req, res) => {
  try {
    console.log("[FLOW][DISTRIBUTOR][GET_ONE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.params.id,
    });
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
    console.log("[FLOW][DISTRIBUTOR][UPDATE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.params.id,
    });
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const distributorId = req.params.id;

    // ONLY allowed fields
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      telephone: req.body.telephone,
      email: req.body.email,
      gstNumber: req.body.gstNumber,
      address: req.body.address,
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
    res.status(500).json({ message: "Error updating distributor" });
  }
};

exports.deleteDistributor = async (req, res) => {
  try {
    console.log("[FLOW][DISTRIBUTOR][DELETE]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.params.id,
    });
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
    console.log("[FLOW][DISTRIBUTOR][STATUS]", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.params.id,
      status: req.body?.status,
    });
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
    console.log("[FLOW][DISTRIBUTOR][SUGGEST] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      term,
    });

    let query = {
      name: { $regex: term, $options: "i" },
    };
    if (!isSuperAdminGlobal(req)) {
      query.shop = req.shopId;
    }

    const results = await Distributor.find(query)
      .sort({ createdAt: -1 })   // 🔥 important
      .limit(10)
      .select("name");
    console.log("[FLOW][DISTRIBUTOR][SUGGEST] response", {
      count: results.length,
      shopId: req.shopId?.toString(),
    });

    res.json(results.map((d) => d.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error searching distributor" });
  }
};
