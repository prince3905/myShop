const mongoose = require("mongoose");

const purchaseReturnItemSchema = new mongoose.Schema(
  {
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
    variation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    consumedDamagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchasePrice: {
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
      enum: ["DAMAGED", "EXPIRED", "WRONG_ITEM", "PRICE_ISSUE", "OTHER"],
      default: "OTHER",
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const purchaseReturnSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
      index: true,
    },
    items: {
      type: [purchaseReturnItemSchema],
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

purchaseReturnSchema.index({ shop: 1, purchase: 1, createdAt: -1 });

module.exports = mongoose.model("PurchaseReturn", purchaseReturnSchema);
