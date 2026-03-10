const Purchase = require("../models/Purchase");
const PurchaseReturn = require("../models/PurchaseReturn");
const DistributorLedger = require("../models/DistributorLedger");

const PAYMENT_METHODS = new Set(["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"]);

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const normalizePaymentMethod = (value) => {
  const normalized = `${value || ""}`.trim().toUpperCase();
  return PAYMENT_METHODS.has(normalized) ? normalized : "CASH";
};

async function syncDistributorPurchaseSnapshots({ distributorId, shopId } = {}) {
  if (!distributorId) {
    return [];
  }

  const purchaseQuery = {
    distributor: distributorId,
    status: "CONFIRMED",
  };
  if (shopId) {
    purchaseQuery.shop = shopId;
  }

  const purchases = await Purchase.find(purchaseQuery)
    .sort({ confirmedAt: 1, purchaseDate: 1, createdAt: 1, _id: 1 });

  if (!purchases.length) {
    return [];
  }

  const effectiveShopId = shopId || purchases[0]?.shop;
  const purchaseIds = purchases.map((purchase) => purchase._id);

  const [returnAgg, paymentLedgers] = await Promise.all([
    PurchaseReturn.aggregate([
      {
        $match: {
          purchase: { $in: purchaseIds },
          status: "APPROVED",
          ...(effectiveShopId ? { shop: effectiveShopId } : {}),
        },
      },
      {
        $group: {
          _id: "$purchase",
          totalReturnedAmount: { $sum: "$totalAmount" },
        },
      },
    ]),
    DistributorLedger.find({
      distributor: distributorId,
      type: "payment",
      isDeleted: false,
      ...(effectiveShopId ? { shop: effectiveShopId } : {}),
    })
      .sort({ transactionDate: 1, createdAt: 1, _id: 1 })
      .select("_id amount paymentMethod note transactionDate createdAt referenceId"),
  ]);

  const returnMap = new Map(
    returnAgg.map((row) => [`${row._id}`, roundAmount(row.totalReturnedAmount || 0)]),
  );

  const purchaseState = purchases.map((purchase) => ({
    purchase,
    id: `${purchase._id}`,
    returnedAmount: roundAmount(returnMap.get(`${purchase._id}`) || 0),
    netPayable: roundAmount(
      Math.max(0, Number(purchase.grandTotal || 0) - Number(returnMap.get(`${purchase._id}`) || 0)),
    ),
    paidAmount: 0,
    paymentHistory: [],
  }));

  const purchaseStateMap = new Map(purchaseState.map((entry) => [entry.id, entry]));

  for (const ledger of paymentLedgers) {
    let remaining = roundAmount(ledger.amount || 0);
    if (remaining <= 0) {
      continue;
    }

    const appendPayment = (targetState, amountToApply) => {
      const safeAmount = roundAmount(amountToApply);
      if (!targetState || safeAmount <= 0) return 0;

      const allowed = roundAmount(Math.max(0, targetState.netPayable - targetState.paidAmount));
      if (allowed <= 0) return 0;

      const applied = roundAmount(Math.min(allowed, safeAmount));
      if (applied <= 0) return 0;

      targetState.paidAmount = roundAmount(targetState.paidAmount + applied);
      targetState.paymentHistory.push({
        ledgerId: ledger._id,
        amount: applied,
        paymentMethod: normalizePaymentMethod(ledger.paymentMethod),
        note: ledger.note || "",
        collectedAt: ledger.transactionDate || ledger.createdAt || new Date(),
      });
      return applied;
    };

    const referencedState = ledger.referenceId
      ? purchaseStateMap.get(`${ledger.referenceId}`)
      : null;
    if (referencedState) {
      const applied = appendPayment(referencedState, remaining);
      remaining = roundAmount(remaining - applied);
    }

    if (remaining <= 0) {
      continue;
    }

    for (const state of purchaseState) {
      if (remaining <= 0) break;
      const applied = appendPayment(state, remaining);
      remaining = roundAmount(remaining - applied);
    }
  }

  for (const state of purchaseState) {
    state.purchase.paidAmount = roundAmount(state.paidAmount);
    state.purchase.returnedAmount = roundAmount(state.returnedAmount);
    state.purchase.dueAmount = roundAmount(
      Math.max(0, Number(state.netPayable || 0) - Number(state.paidAmount || 0)),
    );
    if (state.purchase.paidAmount > 0) {
      const lastPayment = state.paymentHistory[state.paymentHistory.length - 1];
      state.purchase.paymentMethod = normalizePaymentMethod(
        lastPayment?.paymentMethod || state.purchase.paymentMethod,
      );
    }
    state.purchase.paymentHistory = state.paymentHistory;
    await state.purchase.save();
  }

  return purchases;
}

async function syncPurchaseSnapshot({ purchaseId, shopId } = {}) {
  if (!purchaseId) {
    return null;
  }

  const query = { _id: purchaseId };
  if (shopId) {
    query.shop = shopId;
  }

  const purchase = await Purchase.findOne(query).select("_id distributor shop");
  if (!purchase) {
    return null;
  }

  if (purchase.status === "CONFIRMED") {
    await syncDistributorPurchaseSnapshots({
      distributorId: purchase.distributor,
      shopId: shopId || purchase.shop,
    });
  }

  return Purchase.findById(purchase._id);
}

module.exports = {
  syncPurchaseSnapshot,
  syncDistributorPurchaseSnapshots,
  roundAmount,
};
