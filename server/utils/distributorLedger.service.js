const DistributorLedger = require("../models/DistributorLedger");
const Distributor = require("../models/Distributor");

exports.createDistributorLedgerEntry = async ({
  shop,
  distributor,
  type,
  amount,
  referenceId,
  note,
  transactionDate,
  createdBy,
}) => {

  // Get last ledger entry
  const lastEntry = await DistributorLedger.findOne({
    distributor,
    shop,
    isDeleted: false,
  }).sort({ createdAt: -1 });

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

  return ledger;
};