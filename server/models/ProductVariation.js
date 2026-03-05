const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  alt: String,
  isPrimary: { type: Boolean, default: false }
}, { _id: false });

const productVariationSchema = new mongoose.Schema({

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

  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductModel",
    required: true,
    index: true
  },

  sku: {
    type: String,
    required: true,
    trim: true
  },

  barcode: {
    type: String,
    trim: true
  },

  attributes: {
    color: String,
    size: String,
    storage: String,
    material: String
  },

  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },

  costPrice: {
    type: Number,
    default: 0
  },

  quantity: {
  type: Number,
  default: 0,
  min: 0
},

  discount: {
    type: {
      type: String,
      enum: ["FLAT", "PERCENT"],
      default: "FLAT"
    },
    value: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 }
  },

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

/* Unique SKU per shop */
productVariationSchema.index(
  { shop: 1, sku: 1 },
  { unique: true }
);

/* Unique Barcode per shop (if barcode exists) */
productVariationSchema.index(
  { shop: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string", $ne: "" } },
  },
);

module.exports = mongoose.model("ProductVariation", productVariationSchema);
