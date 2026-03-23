const mongoose = require("mongoose");

const staffDailyWorkSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    attendanceStatus: {
      type: String,
      enum: ["PRESENT", "HALF_DAY", "ABSENT"],
      default: "PRESENT",
      required: true,
    },
    workType: {
      type: String,
      trim: true,
      default: "",
    },
    workDetails: {
      type: String,
      trim: true,
      default: "",
    },
    linkedJob: {
      type: String,
      trim: true,
      default: "",
    },
    unitsCompleted: {
      type: Number,
      min: 0,
      default: 0,
    },
    earnedAmount: {
      type: Number,
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

staffDailyWorkSchema.index({ shop: 1, entryDate: -1, createdAt: -1 });
staffDailyWorkSchema.index({ shop: 1, staff: 1, entryDate: -1 });

module.exports = mongoose.model("StaffDailyWork", staffDailyWorkSchema);
