const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false }
}, { _id: false });

const productModelSchema = new mongoose.Schema({

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true
  },

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  description: String,

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

/* Unique model per product */
productModelSchema.index(
  { shop: 1, product: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model("ProductModel", productModelSchema);