const mongoose = require("mongoose");

const orderLedgerSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["order", "payment", "cancellation", "return", "refund"],
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
      enum: ["CASH", "UPI", "CARD", "ONLINE", "BANK_TRANSFER"],
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

orderLedgerSchema.index({ shop: 1, order: 1, type: 1 }, { unique: true });
orderLedgerSchema.index({ shop: 1, customer: 1, createdAt: -1 });

module.exports = mongoose.model("OrderLedger", orderLedgerSchema);
