const logger = require("../utils/logger");
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
      transactionDate,
    } = req.body;
    const normalizedType = `${type || ""}`.trim().toLowerCase();
    const normalizedPaymentMethod = `${paymentMethod || paymentMode || ""}`.trim().toUpperCase();
    const normalizedReferenceId = `${referenceId || purchaseId || ""}`.trim();
    const normalizedReferenceType = `${referenceType || "PURCHASE"}`.trim().toUpperCase();
    const parsedTransactionDate = transactionDate ? new Date(transactionDate) : new Date();

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
      transactionDate: parsedTransactionDate,
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
    logger.error("Create Ledger Error:", err);
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
    logger.error("Get Ledger Error:", err);
    res.status(500).json({ success: false, message: "Error fetching ledger" });
  }
};

// UPDATE LEDGER ENTRY (ADMIN ONLY - WITH FULL AUDIT TRAIL)
exports.updateLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentMode, note, transactionDate, reason } = req.body || {};

    const ledger = await DistributorLedger.findById(id);
    if (!ledger || ledger.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Ledger entry not found",
      });
    }

    if (!isSuperAdminGlobal(req) && `${ledger.shop}` !== `${req.shopId}`) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this ledger entry",
      });
    }

    const previousAmount = Number(ledger.amount || 0);
    const newAmount = amount !== undefined ? Math.max(0, Number(amount)) : previousAmount;
    const previousPaymentMethod = ledger.paymentMethod || "";
    const newPaymentMethod = (paymentMethod || paymentMode !== undefined)
      ? `${paymentMethod || paymentMode || ""}`.trim().toUpperCase()
      : previousPaymentMethod;
    const previousNote = ledger.note || "";
    const newNote = note !== undefined ? `${note || ""}`.trim() : previousNote;
    const previousDate = ledger.transactionDate;
    const newDate = transactionDate ? new Date(transactionDate) : previousDate;

    // Track in editHistory on the document
    if (!Array.isArray(ledger.editHistory)) {
      ledger.editHistory = [];
    }

    ledger.editHistory.push({
      editedAt: new Date(),
      editedBy: req.user._id,
      editorName: [req.user.pFname, req.user.pLname].filter(Boolean).join(" ") || req.user.email,
      editorRole: req.user.role,
      previousAmount,
      newAmount,
      previousPaymentMethod,
      newPaymentMethod,
      previousNote,
      newNote,
      previousTransactionDate: previousDate,
      newTransactionDate: newDate,
      reason: reason || "Admin ledger correction",
      ip: req.ip || req.headers["x-forwarded-for"] || "",
    });

    ledger.amount = newAmount;
    if (ledger.type === "payment" && newPaymentMethod) {
      ledger.paymentMethod = newPaymentMethod;
    }
    ledger.note = newNote;
    ledger.transactionDate = newDate;

    await ledger.save();

    // Rebuild running balances for the distributor
    await rebuildDistributorLedgerBalances({
      shopId: ledger.shop,
      distributorId: ledger.distributor,
    });

    if (["purchase", "payment", "purchase_return"].includes(ledger.type)) {
      await syncDistributorPurchaseSnapshots({
        distributorId: ledger.distributor,
        shopId: ledger.shop,
      });
    }

    const Distributor = require("../models/Distributor");
    const { logEntityAudit } = require("../utils/entityAudit.service");
    const distributor = await Distributor.findById(ledger.distributor).select("name");
    const distributorName = distributor ? distributor.name : "Distributor";

    // Global Entity Audit Log for anti-fraud tracking
    await logEntityAudit({
      shop: ledger.shop,
      entityType: "DISTRIBUTOR_LEDGER",
      entityId: ledger._id,
      action: "DISTRIBUTOR_LEDGER_UPDATE",
      actor: {
        _id: req.user._id,
        name: [req.user.pFname, req.user.pLname].filter(Boolean).join(" ") || req.user.email,
        email: req.user.email,
        role: req.user.role,
      },
      meta: {
        distributorId: ledger.distributor,
        distributorName,
        ledgerType: ledger.type,
        previousAmount,
        newAmount,
        reason: reason || "Admin ledger correction",
        diffSummary: `Admin updated ${ledger.type} entry for ${distributorName}: amount changed from ₹${previousAmount} to ₹${newAmount} (Reason: ${reason || "Correction"})`,
        ip: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    logger.info("Distributor ledger entry updated by admin", {
      ledgerId: ledger._id,
      adminId: req.user._id,
      adminRole: req.user.role,
      previousAmount,
      newAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Ledger entry updated and balances recalculated successfully",
      ledger,
    });
  } catch (err) {
    logger.error("Update Ledger Error:", err);
    return res.status(500).json({
      success: false,
      message: "Error updating ledger entry",
    });
  }
};

// DELETE LEDGER ENTRY (ADMIN ONLY - SOFT DELETE WITH FULL AUDIT TRAIL)
exports.deleteLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const ledger = await DistributorLedger.findById(id);
    if (!ledger || ledger.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Ledger entry not found",
      });
    }

    if (!isSuperAdminGlobal(req) && `${ledger.shop}` !== `${req.shopId}`) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this ledger entry",
      });
    }

    ledger.isDeleted = true;
    ledger.deletedAt = new Date();
    ledger.deletedBy = req.user._id;
    ledger.deletionReason = reason || "Deleted by admin";

    await ledger.save();

    // Rebuild balances without this deleted entry
    await rebuildDistributorLedgerBalances({
      shopId: ledger.shop,
      distributorId: ledger.distributor,
    });

    if (["purchase", "payment", "purchase_return"].includes(ledger.type)) {
      await syncDistributorPurchaseSnapshots({
        distributorId: ledger.distributor,
        shopId: ledger.shop,
      });
    }

    const Distributor = require("../models/Distributor");
    const { logEntityAudit } = require("../utils/entityAudit.service");
    const distributor = await Distributor.findById(ledger.distributor).select("name");
    const distributorName = distributor ? distributor.name : "Distributor";

    // Global Entity Audit Log for anti-fraud tracking
    await logEntityAudit({
      shop: ledger.shop,
      entityType: "DISTRIBUTOR_LEDGER",
      entityId: ledger._id,
      action: "DISTRIBUTOR_LEDGER_DELETE",
      actor: {
        _id: req.user._id,
        name: [req.user.pFname, req.user.pLname].filter(Boolean).join(" ") || req.user.email,
        email: req.user.email,
        role: req.user.role,
      },
      meta: {
        distributorId: ledger.distributor,
        distributorName,
        ledgerType: ledger.type,
        deletedAmount: ledger.amount,
        reason: reason || "Deleted by admin",
        diffSummary: `Admin deleted ${ledger.type} entry of ₹${ledger.amount} for ${distributorName}. (Reason: ${reason || "Correction"})`,
        ip: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    logger.info("Distributor ledger entry deleted by admin", {
      ledgerId: ledger._id,
      adminId: req.user._id,
      adminRole: req.user.role,
      deletedAmount: ledger.amount,
      distributorName,
    });

    return res.status(200).json({
      success: true,
      message: "Ledger entry deleted and balances recalculated successfully",
    });
  } catch (err) {
    logger.error("Delete Ledger Error:", err);
    return res.status(500).json({
      success: false,
      message: "Error deleting ledger entry",
    });
  }
};
