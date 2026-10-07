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

    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"],
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
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deletionReason: {
      type: String,
      trim: true,
    },
    editHistory: [
      {
        editedAt: {
          type: Date,
          default: Date.now,
        },
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        editorName: {
          type: String,
        },
        editorRole: {
          type: String,
        },
        previousAmount: Number,
        newAmount: Number,
        previousPaymentMethod: String,
        newPaymentMethod: String,
        previousNote: String,
        newNote: String,
        previousTransactionDate: Date,
        newTransactionDate: Date,
        reason: String,
        ip: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("DistributorLedger", distributorLedgerSchema);
