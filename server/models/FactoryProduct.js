const mongoose = require("mongoose");

const standardMaterialLineSchema = new mongoose.Schema(
  {
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      default: null,
    },
    materialName: {
      type: String,
      trim: true,
      default: "",
    },
    qtyPerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    unitLabel: {
      type: String,
      trim: true,
      default: "PCS",
    },
    rate: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const factoryProductSchema = new mongoose.Schema(
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
    workerPieceRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    standardLabourCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    standardOtherCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    standardWasteQtyPerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    standardWasteUnitLabel: {
      type: String,
      trim: true,
      default: "KG",
    },
    standardWasteValuePerUnit: {
      type: Number,
      min: 0,
      default: 0,
    },
    standardMaterialLines: {
      type: [standardMaterialLineSchema],
      default: [],
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
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

factoryProductSchema.index({ shop: 1, name: 1 });
factoryProductSchema.index({ shop: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("FactoryProduct", factoryProductSchema);
