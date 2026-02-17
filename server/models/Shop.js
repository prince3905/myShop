const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
  },

  shopCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  contactNumber: {
    type: String,
    trim: true,
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
  },

  address: {
    state: String,
    district: String,
    city: String,
    pincode: String,
    addressLine1: String,
    addressLine2: String,
  },

  shopType: {
    type: String,
    enum: ["POS", "ECOMMERCE", "HYBRID"],
    default: "HYBRID",
  },

  subscriptionPlan: {
    type: String,
    enum: ["FREE", "BASIC", "PRO", "ENTERPRISE"],
    default: "FREE",
  },

  subscriptionExpiry: {
    type: Date,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

}, { timestamps: true });

/* Compound index for safety */
shopSchema.index({ owner: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Shop", shopSchema);
