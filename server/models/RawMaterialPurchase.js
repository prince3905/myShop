const mongoose = require("mongoose");

const rawMaterialPurchaseItemSchema = new mongoose.Schema(
  {
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
    },
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    unitLabel: {
      type: String,
      trim: true,
      default: "PCS",
    },
    sizeLabel: {
      type: String,
      trim: true,
      default: "",
    },
    colorLabel: {
      type: String,
      trim: true,
      default: "",
    },
    orderedQty: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedQty: {
      type: Number,
      required: true,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false },
);

const rawMaterialPurchaseSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
      index: true,
    },
    invoiceNo: {
      type: String,
      trim: true,
      default: "",
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING_RECEIPT", "APPROVED", "CANCELLED"],
      default: "PENDING_RECEIPT",
      index: true,
    },
    items: {
      type: [rawMaterialPurchaseItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"],
      default: "CASH",
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

rawMaterialPurchaseSchema.index({ shop: 1, status: 1, purchaseDate: -1 });
rawMaterialPurchaseSchema.index({ shop: 1, distributor: 1, purchaseDate: -1 });
rawMaterialPurchaseSchema.index(
  { shop: 1, invoiceNo: 1 },
  { unique: true, partialFilterExpression: { invoiceNo: { $type: "string", $ne: "" } } },
);

module.exports = mongoose.model("RawMaterialPurchase", rawMaterialPurchaseSchema);
