const SaleLedger = require("../models/SaleLedger");

const getDelta = (type, amount) => {
  switch (type) {
    case "sale":
      return Math.abs(amount);
    case "payment":
    case "wallet_use":
    case "return_due_adjustment":
      return -Math.abs(amount);
    case "return_refund":
    case "return_credit":
      return 0;
    default:
      throw new Error("Invalid sale ledger type");
  }
};

exports.createSaleLedgerEntry = async ({
  shop,
  sale,
  customer = null,
  customerName = "",
  type,
  amount,
  paymentMethod,
  referenceId = null,
  note = "",
  createdBy = null,
}) => {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (safeAmount <= 0) return null;

  const lastEntry = await SaleLedger.findOne({ shop, sale }).sort({ createdAt: -1, _id: -1 });
  const previousBalance = Number(lastEntry?.balanceAfterTransaction || 0);
  const delta = getDelta(type, safeAmount);
  const balanceAfter = Math.max(0, Number((previousBalance + delta).toFixed(2)));

  const ledger = await SaleLedger.create({
    shop,
    sale,
    customer: customer || undefined,
    customerName: `${customerName || ""}`.trim(),
    type,
    amount: safeAmount,
    paymentMethod,
    balanceAfterTransaction: balanceAfter,
    referenceId,
    note,
    createdBy: createdBy || undefined,
  });

  return ledger;
};
