const mongoose = require("mongoose");

const staffWorkItemSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    workTypeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StaffWorkType",
      default: null,
      index: true,
    },
    workType: {
      type: String,
      required: true,
      trim: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      trim: true,
      default: "PCS",
    },
    pieceRate: {
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

staffWorkItemSchema.index(
  { shop: 1, workType: 1, itemName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
staffWorkItemSchema.index({ shop: 1, workType: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("StaffWorkItem", staffWorkItemSchema);
