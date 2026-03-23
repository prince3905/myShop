const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema(
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
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    workType: {
      type: String,
      required: true,
      trim: true,
    },
    rateType: {
      type: String,
      enum: ["DAILY", "PIECE"],
      default: "DAILY",
      required: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
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

staffSchema.index({ shop: 1, name: 1, workType: 1 });
staffSchema.index({ shop: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("Staff", staffSchema);
