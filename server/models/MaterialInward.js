const mongoose = require("mongoose");

const materialInwardSchema = new mongoose.Schema(
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
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawMaterial",
      required: true,
      index: true,
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
    supplierName: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceNo: {
      type: String,
      trim: true,
      default: "",
    },
    qty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "CASH",
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

materialInwardSchema.virtual("totalAmount").get(function totalAmount() {
  return Number(this.qty || 0) * Number(this.rate || 0);
});

materialInwardSchema.set("toJSON", { virtuals: true });
materialInwardSchema.set("toObject", { virtuals: true });

materialInwardSchema.index({ shop: 1, entryDate: -1, createdAt: -1 });
materialInwardSchema.index({ shop: 1, rawMaterial: 1, invoiceNo: 1 });

module.exports = mongoose.model("MaterialInward", materialInwardSchema);
