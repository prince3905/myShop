const DistributorLedger = require("../models/DistributorLedger");
const Purchase = require("../models/Purchase");
const RawMaterialPurchase = require("../models/RawMaterialPurchase");
const { createDistributorLedgerEntry, rebuildDistributorLedgerBalances } = require("../utils/distributorLedger.service");
const { syncDistributorPurchaseSnapshots } = require("../utils/purchaseAccount.service");

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
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const {
      distributorId,
      type,
      amount,
      paymentMode,
      paymentMethod,
      note,
      referenceId,
      purchaseId,
      referenceType,
    } = req.body;
    const normalizedType = `${type || ""}`.trim().toLowerCase();
    const normalizedPaymentMethod = `${paymentMethod || paymentMode || ""}`.trim().toUpperCase();
    const normalizedReferenceId = `${referenceId || purchaseId || ""}`.trim();
    const normalizedReferenceType = `${referenceType || "PURCHASE"}`.trim().toUpperCase();

    if (normalizedReferenceId) {
      let targetPurchase = null;
      if (normalizedReferenceType === "RAW_MATERIAL_PURCHASE") {
        targetPurchase = await RawMaterialPurchase.findOne({
          _id: normalizedReferenceId,
          distributor: distributorId,
          shop: req.shopId,
          isDeleted: { $ne: true },
        }).select("_id dueAmount paidAmount subtotal paymentMethod");
      } else {
        targetPurchase = await Purchase.findOne({
          _id: normalizedReferenceId,
          distributor: distributorId,
          shop: req.shopId,
        }).select("_id dueAmount");
      }

      if (!targetPurchase) {
        return res.status(404).json({
          success: false,
          message: "Selected purchase not found for this distributor",
        });
      }

      if (normalizedType === "payment") {
        const paymentAmount = Math.max(0, Number(amount || 0));
        const purchaseDueAmount = Math.max(0, Number(targetPurchase.dueAmount || 0));
        if (paymentAmount > purchaseDueAmount) {
          return res.status(400).json({
            success: false,
            message: `Payment cannot exceed purchase due amount ${purchaseDueAmount.toFixed(2)}`,
          });
        }
      }
    }

    const ledger = await createDistributorLedgerEntry({
      shop: req.shopId,
      distributor: distributorId,
      type: normalizedType,
      amount,
      paymentMethod: normalizedPaymentMethod || (normalizedType === "payment" ? "CASH" : undefined),
      referenceId: normalizedReferenceId || undefined,
      note,
      createdBy: req.user._id,
    });

    await syncDistributorPurchaseSnapshots({
      distributorId,
      shopId: req.shopId,
    });

    if (normalizedReferenceId && normalizedType === "payment" && normalizedReferenceType === "RAW_MATERIAL_PURCHASE") {
      const rawMaterialPurchase = await RawMaterialPurchase.findOne({
        _id: normalizedReferenceId,
        distributor: distributorId,
        shop: req.shopId,
        isDeleted: { $ne: true },
      });

      if (rawMaterialPurchase) {
        rawMaterialPurchase.paidAmount = Math.max(0, Number(rawMaterialPurchase.paidAmount || 0) + Number(amount || 0));
        rawMaterialPurchase.dueAmount = Math.max(0, Number(rawMaterialPurchase.subtotal || 0) - Number(rawMaterialPurchase.paidAmount || 0));
        rawMaterialPurchase.paymentMethod = normalizedPaymentMethod || rawMaterialPurchase.paymentMethod || "CASH";
        await rawMaterialPurchase.save();
      }
    }

    res.status(201).json({
      success: true,
      ledger,
    });
  } catch (err) {
    console.error("Create Ledger Error:", err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: "Error creating ledger",
    });
  }
};

// GET LEDGER
exports.getDistributorLedger = async (req, res) => {
  try {
    if (!isSuperAdminGlobal(req) && req.shopId) {
      await rebuildDistributorLedgerBalances({
        shopId: req.shopId,
        distributorId: req.params.distributorId,
      });
    }

    const filter = {
      distributor: req.params.distributorId,
      isDeleted: { $ne: true },
    };
    if (!isSuperAdminGlobal(req)) {
      filter.shop = req.shopId;
    }

    const ledger = await DistributorLedger.find(filter).sort({
      transactionDate: -1,
      createdAt: -1,
      _id: -1,
    });

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
    res.json({
      success: true,
      ledger: enrichedLedger,
    });
  } catch (err) {
    console.error("Get Ledger Error:", err);
    res.status(500).json({ success: false, message: "Error fetching ledger" });
  }
};
