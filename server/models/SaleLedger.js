const mongoose = require("mongoose");

const saleLedgerSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    customerName: {
      type: String,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["sale", "payment", "wallet_use", "return_due_adjustment", "return_refund", "return_credit"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CREDIT", "STORE_CREDIT"],
    },
    balanceAfterTransaction: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

saleLedgerSchema.index({ shop: 1, sale: 1, createdAt: -1 });

module.exports = mongoose.model("SaleLedger", saleLedgerSchema);
