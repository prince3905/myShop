const mongoose = require("mongoose");

const distributorSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    shopName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    telephone: {
      type: String,
      trim: true,
    },

    gstNumber: {
      type: String,
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

    openingBalance: {
      type: Number,
      default: 0,
    },

    currentBalance: {
      type: Number,
      default: 0,
    },

    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentTerms: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: Date,

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

/* Compound index (same distributor allowed in different shops) */
distributorSchema.index(
  { shop: 1, phone: 1},
  { unique: true, sparse: true },
);


module.exports = mongoose.model("Distributor", distributorSchema);
