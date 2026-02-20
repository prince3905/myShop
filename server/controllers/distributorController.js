const Distributor = require("../models/Distributor");
const {
  createDistributorLedgerEntry,
} = require("../utils/distributorLedger.service");

exports.allDistributors = async (req, res) => {
  try {
    const { name, phone, page = 1, perPage = 10, shopId } = req.query;

    let query = {};

    // 🔐 ROLE BASED FILTER
    if (req.user.role === "SUPER_ADMIN") {
      // If shopId provided → filter
      if (shopId) {
        query.shop = shopId;
      }
      // else → no shop filter (see all)
    } else {
      // Normal admin → only their shop
      query.shop = req.user.shop;
    }

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
    let shopId;

    if (req.user.role === "SUPER_ADMIN") {
      if (!req.body.shop) {
        return res.status(400).json({
          success: false,
          message: "Shop ID required",
        });
      }
      shopId = req.body.shop;
    } else {
      shopId = req.user.shop;
    }

    const distributor = new Distributor({
      ...req.body,
      shop: shopId,
      currentBalance: 0, // IMPORTANT
    });

    const savedDistributor = await distributor.save();

    // ✅ Opening Balance Ledger Entry
    const openingAmount = Number(req.body.openingBalance) || 0;

    if (openingAmount > 0) {
      console.log("Creating opening ledger entry...");

      await createDistributorLedgerEntry({
        shop: shopId,
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
    let query = { _id: req.params.id };

    if (req.user.role !== "SUPER_ADMIN") {
      query.shop = req.user.shop;
    }

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

    const updatedDistributor = await Distributor.findByIdAndUpdate(
      distributorId,
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
    let query = { _id: req.params.id };

    if (req.user.role !== "SUPER_ADMIN") {
      query.shop = req.user.shop;
    }

    const deleted = await Distributor.findOneAndDelete(query);

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
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "disabled", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    distributor.status = status;
    await distributor.save();

    return res.json({
      success: true,
      message: "Status updated",
      data: { id: distributor._id, status: distributor.status },
    });
  } catch (err) {
    console.error("updateStatus error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.distributorSuggestions = async (req, res) => {
  try {
    const { term } = req.query;

    let query = {
      name: { $regex: term, $options: "i" },
    };

    // ROLE BASED FILTER
    if (req.user.role !== "SUPER_ADMIN") {
      query.shop = req.user.shop;
    } else if (req.query.shopId) {
      query.shop = req.query.shopId;
    }

    const results = await Distributor.find(query)
      .sort({ createdAt: -1 })   // 🔥 important
      .limit(10)
      .select("name");

    res.json(results.map((d) => d.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error searching distributor" });
  }
};
