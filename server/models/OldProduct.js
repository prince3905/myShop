const mongoose = require("mongoose");

/* =========================
   IMAGE SCHEMA
========================= */
const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false }
}, { _id: false });

/* =========================
   PRODUCT (MAIN INFO)
========================= */
const productSchema = new mongoose.Schema({

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

  slug: {
    type: String,
    trim: true,
    lowercase: true,
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true,
  },

  description: String,

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true,
  }

}, { timestamps: true });

productSchema.index({ name: "text" });

module.exports = mongoose.model("Product", productSchema);