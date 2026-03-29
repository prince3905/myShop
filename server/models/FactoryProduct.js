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
    shopCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    shopBrand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },
    shopProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    shopModel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductModel",
      default: null,
      index: true,
    },
    shopVariation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariation",
      default: null,
      index: true,
    },
    variationColor: {
      type: String,
      trim: true,
      default: "",
    },
    variationSize: {
      type: String,
      trim: true,
      default: "",
    },
    defaultSellingPrice: {
      type: Number,
      min: 0,
      default: 0,
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
