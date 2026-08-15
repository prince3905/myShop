const mongoose = require("mongoose");

const rawMaterialSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
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
    openingQty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    packPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    pcsPerPack: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    supplierName: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
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
    rateHistory: [
      {
        oldRate: Number,
        newRate: Number,
        oldPackPrice: Number,
        newPackPrice: Number,
        reason: String,
        changedAt: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true },
);

rawMaterialSchema.index({ shop: 1, name: 1 });
rawMaterialSchema.index({ shop: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);
