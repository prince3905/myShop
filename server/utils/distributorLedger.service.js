const DistributorLedger = require("../models/DistributorLedger");
const Distributor = require("../models/Distributor");
const { syncDistributorPurchaseSnapshots } = require("./purchaseAccount.service");

exports.createDistributorLedgerEntry = async ({
  shop,
  distributor,
  type,
  amount,
  paymentMethod,
  referenceId,
  note,
  transactionDate,
  createdBy,
}) => {

  // Get last ledger entry
  const lastEntry = await DistributorLedger.findOne({
    distributor,
    shop,
    isDeleted: { $ne: true },
  }).sort({ transactionDate: -1, createdAt: -1, _id: -1 });

  let previousBalance = lastEntry
    ? lastEntry.balanceAfterTransaction
    : 0;

  let newBalance = 0;

  // Balance calculation logic
  switch (type) {

    case "opening":
      if (lastEntry) {
        throw new Error("Opening balance already exists");
      }
      newBalance = amount;
      break;

    case "purchase":
      newBalance = previousBalance + amount;
      break;

    case "payment":
    case "purchase_return":
      newBalance = previousBalance - amount;
      break;

    case "adjustment":
      // adjustment can be + or -
      newBalance = previousBalance + amount;
      break;

    default:
      throw new Error("Invalid ledger type");
  }

  // Create ledger entry
  const ledger = await DistributorLedger.create({
    shop,
    distributor,
    type,
    amount,
    paymentMethod:
      type === "payment"
        ? `${paymentMethod || "CASH"}`.trim().toUpperCase()
        : undefined,
    balanceAfterTransaction: newBalance,
    referenceId,
    note,
    transactionDate,
    createdBy,
  });

  // Update distributor current balance
  await Distributor.findByIdAndUpdate(distributor, {
    currentBalance: newBalance,
  });

  if (["purchase", "payment", "purchase_return"].includes(type)) {
    await syncDistributorPurchaseSnapshots({
      distributorId: distributor,
      shopId: shop,
    });
  }

  return ledger;
};

exports.rebuildDistributorLedgerBalances = async ({ shopId, distributorId }) => {
  if (!shopId || !distributorId) {
    return [];
  }

  const entries = await DistributorLedger.find({
    shop: shopId,
    distributor: distributorId,
    isDeleted: { $ne: true },
  }).sort({ transactionDate: 1, createdAt: 1, _id: 1 });

  let runningBalance = 0;

  for (const entry of entries) {
    const amount = Number(entry.amount || 0);
    switch (`${entry.type || ""}`) {
      case "opening":
        runningBalance = amount;
        break;
      case "purchase":
        runningBalance += amount;
        break;
      case "payment":
      case "purchase_return":
        runningBalance -= amount;
        break;
      case "adjustment":
        runningBalance += amount;
        break;
      default:
        break;
    }

    if (Number(entry.balanceAfterTransaction || 0) !== runningBalance) {
      entry.balanceAfterTransaction = runningBalance;
      await entry.save();
    }
  }

  await Distributor.findByIdAndUpdate(distributorId, {
    currentBalance: runningBalance,
  });

  return entries;
};
