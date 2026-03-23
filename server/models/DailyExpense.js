const mongoose = require("mongoose");

const dailyExpenseSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    accountHead: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"],
      required: true,
      default: "CASH",
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
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

dailyExpenseSchema.index({ shop: 1, expenseDate: -1, createdAt: -1 });
dailyExpenseSchema.index({ shop: 1, category: 1, department: 1 });

module.exports = mongoose.model("DailyExpense", dailyExpenseSchema);
