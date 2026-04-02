const mongoose = require("mongoose");

const roleFeatureSettingSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      default: "GLOBAL",
      unique: true,
      trim: true,
    },
    policy: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RoleFeatureSetting", roleFeatureSettingSchema);
