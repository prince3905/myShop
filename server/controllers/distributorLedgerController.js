const DistributorLedger = require("../models/DistributorLedger");
const Purchase = require("../models/Purchase");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const resolveModeFromNote = (note = "") => {
  const upper = `${note || ""}`.toUpperCase();
  const modes = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"];
  return modes.find((m) => upper.includes(m)) || "";
};

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

    const { distributorId, type, amount, paymentMode, paymentMethod, note } = req.body;
    const normalizedPaymentMethod = `${paymentMethod || paymentMode || ""}`.trim().toUpperCase();

    const ledger = await createDistributorLedgerEntry({
      shop: req.shopId,
      distributor: distributorId,
      type,
      amount,
      paymentMethod: normalizedPaymentMethod || (type === "payment" ? "CASH" : undefined),
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

    const missingPaymentModeRefs = ledger
      .filter((e) => e?.type === "payment" && !(`${e?.paymentMethod || ""}`.trim()) && e?.referenceId)
      .map((e) => `${e.referenceId}`);
    const uniqueRefs = [...new Set(missingPaymentModeRefs)];

    let purchaseMap = new Map();
    if (uniqueRefs.length) {
      const purchases = await Purchase.find({ _id: { $in: uniqueRefs } }).select("_id paymentMethod");
      purchaseMap = new Map(
        purchases.map((p) => [`${p._id}`, `${p?.paymentMethod || ""}`.trim().toUpperCase()]),
      );
    }

    const enrichedLedger = ledger.map((entry) => {
      const current = `${entry?.paymentMethod || ""}`.trim().toUpperCase();
      if (current) return entry;

      const fromPurchase = entry?.referenceId ? `${purchaseMap.get(`${entry.referenceId}`) || ""}` : "";
      const fromNote = resolveModeFromNote(entry?.note || "");
      const resolved = (fromPurchase || fromNote || (entry?.type === "payment" ? "CASH" : "")).trim();
      if (!resolved) return entry;

      const obj = entry.toObject();
      obj.paymentMethod = resolved;
      return obj;
    });
    console.log("[FLOW][LEDGER][LIST] response", {
      count: enrichedLedger.length,
      shopId: req.shopId?.toString(),
      global: isSuperAdminGlobal(req),
    });

    res.json({
      success: true,
      ledger: enrichedLedger,
    });
  } catch (err) {
    console.error("Get Ledger Error:", err);
    res.status(500).json({ message: "Error fetching ledger" });
  }
};
