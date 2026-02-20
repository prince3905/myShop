const mongoose = require("mongoose");

const distributorLedgerSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "opening",
        "purchase",
        "payment",
        "purchase_return",
        "adjustment"
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    balanceAfterTransaction: {
      type: Number,
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    note: {
      type: String,
      trim: true,
    },

    transactionDate: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("DistributorLedger", distributorLedgerSchema);