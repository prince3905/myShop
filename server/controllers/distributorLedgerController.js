const DistributorLedger = require("../models/DistributorLedger");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");

// CREATE LEDGER ENTRY
exports.createLedger = async (req, res) => {
  try {
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
    const ledger = await DistributorLedger.find({
      distributor: req.params.distributorId,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      ledger,
    });
  } catch (err) {
    console.error("Get Ledger Error:", err);
    res.status(500).json({ message: "Error fetching ledger" });
  }
};