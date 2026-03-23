const mongoose = require("mongoose");

const staffPaymentSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ["ADVANCE", "PAYMENT"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"],
      default: "CASH",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

staffPaymentSchema.index({ shop: 1, staff: 1, entryDate: -1, createdAt: -1 });
staffPaymentSchema.index({ shop: 1, entryType: 1, paymentMethod: 1 });

module.exports = mongoose.model("StaffPayment", staffPaymentSchema);
