const mongoose = require("mongoose");

const factoryPushHistorySchema = new mongoose.Schema(
  {
    sourceShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    targetShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    dailyWork: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffDailyWork",
      required: true,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
      index: true,
    },
    factoryProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FactoryProduct",
      default: null,
      index: true,
    },
    sourceVariation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      default: null,
    },
    targetVariation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductModel",
      default: null,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    quantity: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: "PCS",
    },
    productionDate: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationStatus: {
      type: String,
      trim: true,
      default: "PENDING",
    },
    costPerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    sellingPriceSnapshot: {
      type: Number,
      min: 0,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    pushedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    pushedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

factoryPushHistorySchema.index({ sourceShop: 1, pushedAt: -1 });
factoryPushHistorySchema.index({ targetShop: 1, pushedAt: -1 });

module.exports = mongoose.model("FactoryPushHistory", factoryPushHistorySchema);
