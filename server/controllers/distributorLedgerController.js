const DistributorLedger = require("../models/DistributorLedger");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

// CREATE LEDGER ENTRY
exports.createLedger = async (req, res) => {
  try {
    console.log("[FLOW][LEDGER][CREATE] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.body?.distributorId,
      type: req.body?.type,
      amount: req.body?.amount,
    });

    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const { distributorId, type, amount, note } = req.body;

    const ledger = await createDistributorLedgerEntry({
      shop: req.shopId,
      distributor: distributorId,
      type,
      amount,
      note,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      ledger,
    });
  } catch (err) {
    console.error("Create Ledger Error:", err);
    res.status(500).json({ message: "Error creating ledger" });
  }
};

// GET LEDGER
exports.getDistributorLedger = async (req, res) => {
  try {
    console.log("[FLOW][LEDGER][LIST] request", {
      userId: req.user?._id?.toString(),
      role: req.user?.role,
      shopId: req.shopId?.toString(),
      distributorId: req.params.distributorId,
    });

    const filter = {
      distributor: req.params.distributorId,
      isDeleted: false,
    };
    if (!isSuperAdminGlobal(req)) {
      filter.shop = req.shopId;
    }

    const ledger = await DistributorLedger.find(filter).sort({ createdAt: -1 });
    console.log("[FLOW][LEDGER][LIST] response", {
      count: ledger.length,
      shopId: req.shopId?.toString(),
      global: isSuperAdminGlobal(req),
    });

    res.json({
      success: true,
      ledger,
    });
  } catch (err) {
    console.error("Get Ledger Error:", err);
    res.status(500).json({ message: "Error fetching ledger" });
  }
};
