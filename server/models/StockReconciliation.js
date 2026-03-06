const mongoose = require("mongoose");

const lineSchema = new mongoose.Schema(
  {
    variation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductModel",
      required: true,
    },
    sku: {
      type: String,
      trim: true,
      required: true,
    },
    productName: {
      type: String,
      trim: true,
      default: "",
    },
    modelName: {
      type: String,
      trim: true,
      default: "",
    },
    systemQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    countedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    varianceQty: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const stockReconciliationSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    monthKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED"],
      default: "DRAFT",
      index: true,
    },
    lines: {
      type: [lineSchema],
      default: [],
    },
    summary: {
      totalLines: { type: Number, default: 0 },
      matchedLines: { type: Number, default: 0 },
      mismatchLines: { type: Number, default: 0 },
      totalSystemQty: { type: Number, default: 0 },
      totalCountedQty: { type: Number, default: 0 },
      totalVarianceQty: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submittedAt: Date,
    approvedAt: Date,
  },
  { timestamps: true },
);

stockReconciliationSchema.index({ shop: 1, monthKey: 1 }, { unique: true });

module.exports = mongoose.model("StockReconciliation", stockReconciliationSchema);
