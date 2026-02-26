const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false }
}, { _id: false });

const productSchema = new mongoose.Schema({

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  slug: {
    type: String,
    trim: true,
    lowercase: true
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true
  },

  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    required: true,
    index: true
  },

  description: String,

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

/* Unique product per shop */
productSchema.index({ shop: 1, name: 1 }, { unique: true });

/* Text search */
productSchema.index({ name: "text" });

productSchema.virtual("variations", {
  ref: "ProductVariation",
  localField: "_id",
  foreignField: "product"
});

productSchema.set("toObject", { virtuals: true });
productSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);