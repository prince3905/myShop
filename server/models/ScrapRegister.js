const mongoose = require("mongoose");

const scrapRegisterSchema = new mongoose.Schema(
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
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ["PRODUCTION", "RAW_MATERIAL", "CUTTING", "OTHER"],
      default: "PRODUCTION",
      required: true,
    },
    sourceRef: {
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
    unitLabel: {
      type: String,
      trim: true,
      default: "KG",
    },
    estimatedValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
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

scrapRegisterSchema.index({ shop: 1, entryDate: -1, createdAt: -1 });
scrapRegisterSchema.index({ shop: 1, itemName: 1, sourceType: 1 });

module.exports = mongoose.model("ScrapRegister", scrapRegisterSchema);
