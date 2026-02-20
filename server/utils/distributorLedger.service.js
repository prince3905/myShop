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
  // 1️ Last entry
  const lastEntry = await DistributorLedger.findOne({
    distributor,
    shop,
    isDeleted: false,
  }).sort({ createdAt: -1 });

  let newBalance = 0;

  if (!lastEntry) {
    newBalance = amount;
    console.log("Ledger service called");
    console.log("Type:", type, "Amount:", amount);
  } else {
    if (type === "payment" || type === "purchase_return") {
      newBalance = lastEntry.balanceAfterTransaction - amount;
    } else {
      newBalance = lastEntry.balanceAfterTransaction + amount;
    }
  }

  // 2️ Ledger save karo
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

  // 3️ Distributor balance update karo
  await Distributor.findByIdAndUpdate(distributor, {
    currentBalance: newBalance,
  });

  return ledger;
};
