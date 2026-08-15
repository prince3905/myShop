const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    logo: String,

    shops: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Shop",
      required: true,
    },

    ownerShop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

brandSchema.index({ name: 1 });
brandSchema.index({ ownerShop: 1 });
brandSchema.index({ shops: 1 });

module.exports = mongoose.model("Brand", brandSchema);