const mongoose = require("mongoose");

const saleReturnItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      required: true,
      index: true,
    },
    variationSku: {
      type: String,
      required: true,
      trim: true,
    },
    itemName: {
      type: String,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    size: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: ["DAMAGED", "WRONG_ITEM", "CUSTOMER_REJECTED", "WARRANTY", "OTHER"],
      default: "OTHER",
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const saleReturnSchema = new mongoose.Schema(
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
    customerName: {
      type: String,
      trim: true,
    },
    items: {
      type: [saleReturnItemSchema],
      default: [],
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundMethod: {
      type: String,
      enum: ["CASH", "BANK", "ONLINE", "UPI", "CARD", "STORE_CREDIT"],
      default: "CASH",
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueAdjustedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["APPROVED"],
      default: "APPROVED",
      index: true,
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

saleReturnSchema.index({ shop: 1, sale: 1, createdAt: -1 });

module.exports = mongoose.model("SaleReturn", saleReturnSchema);
