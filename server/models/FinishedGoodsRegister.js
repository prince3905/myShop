const mongoose = require("mongoose");

const finishedGoodsRegisterSchema = new mongoose.Schema(
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
    serialNo: {
      type: String,
      trim: true,
      default: "",
    },
    batchNo: {
      type: String,
      trim: true,
      default: "",
    },
    qtyReady: {
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
    estimatedUnitValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    linkedProductionRef: {
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

finishedGoodsRegisterSchema.virtual("totalEstimatedValue").get(function totalEstimatedValue() {
  return Number(this.qtyReady || 0) * Number(this.estimatedUnitValue || 0);
});

finishedGoodsRegisterSchema.set("toJSON", { virtuals: true });
finishedGoodsRegisterSchema.set("toObject", { virtuals: true });

finishedGoodsRegisterSchema.index({ shop: 1, entryDate: -1, createdAt: -1 });
finishedGoodsRegisterSchema.index({ shop: 1, itemName: 1, serialNo: 1, batchNo: 1 });

module.exports = mongoose.model("FinishedGoodsRegister", finishedGoodsRegisterSchema);
