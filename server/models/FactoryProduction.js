const mongoose = require("mongoose");

const materialLineSchema = new mongoose.Schema(
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
    qtyUsed: {
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
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const factoryProductionSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    serialNo: {
      type: String,
      trim: true,
      default: "",
    },
    productRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FactoryProduct",
      default: null,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    itemDescription: {
      type: String,
      trim: true,
      default: "",
    },
    rawMaterialDetails: {
      type: String,
      trim: true,
      default: "",
    },
    materialLines: {
      type: [materialLineSchema],
      default: [],
    },
    materialCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    labourCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    otherCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    qtyProduced: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unitLabel: {
      type: String,
      trim: true,
      default: "PCS",
    },
    wasteQty: {
      type: Number,
      min: 0,
      default: 0,
    },
    workersInvolved: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      default: "",
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

factoryProductionSchema.virtual("totalCost").get(function totalCost() {
  return Number(this.materialCost || 0) + Number(this.labourCost || 0) + Number(this.otherCost || 0);
});

factoryProductionSchema.virtual("costPerUnit").get(function costPerUnit() {
  const qty = Number(this.qtyProduced || 0);
  if (qty <= 0) return 0;
  return this.totalCost / qty;
});

factoryProductionSchema.set("toJSON", { virtuals: true });
factoryProductionSchema.set("toObject", { virtuals: true });

factoryProductionSchema.index({ shop: 1, entryDate: -1, createdAt: -1 });
factoryProductionSchema.index({ shop: 1, itemName: 1, serialNo: 1 });

module.exports = mongoose.model("FactoryProduction", factoryProductionSchema);
