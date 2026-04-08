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
    // Sequence number to allow multiple payments of same type
    sequenceNo: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

// Indexes
saleLedgerSchema.index({ shop: 1, sale: 1, createdAt: -1 });

// Compound indexes for customer ledger queries (500 shops scale)
saleLedgerSchema.index({ shop: 1, customer: 1, createdAt: -1 });
saleLedgerSchema.index({ shop: 1, type: 1, createdAt: -1 });
saleLedgerSchema.index({ shop: 1, customer: 1, type: 1, createdAt: -1 });

// UNIQUE CONSTRAINT: Prevent duplicate ledger entries
// Allows multiple payments but prevents exact duplicates
saleLedgerSchema.index(
  { shop: 1, sale: 1, type: 1, amount: 1, paymentMethod: 1, sequenceNo: 1 },
  { unique: true, name: "unique_ledger_entry" },
);

module.exports = mongoose.model("SaleLedger", saleLedgerSchema);
