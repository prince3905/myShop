const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
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
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUSTMENT", "RESERVE", "RELEASE"],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    deltaQuantity: {
      type: Number,
      required: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceType: {
      type: String,
      enum: ["PURCHASE", "SALE", "ORDER", "RETURN", "MANUAL", "RESERVATION"],
      default: "MANUAL",
      index: true,
    },
    referenceId: mongoose.Schema.Types.ObjectId,
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

stockTransactionSchema.index({ shop: 1, variation: 1, createdAt: -1 });

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
