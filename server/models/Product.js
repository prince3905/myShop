

const mongoose = require("mongoose");

/* =========================
   IMAGE SCHEMA (Reusable)
========================= */
const imageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  alt: String,
  isPrimary: {
    type: Boolean,
    default: false,
  }
}, { _id: false });


/* =========================
   VARIATION SCHEMA
   (Color / Size / SKU Level)
========================= */
const variationSchema = new mongoose.Schema({

  sku: {
    type: String,
    required: true,
    trim: true,
  },

  color: {
    type: String,
    trim: true,
  },

  size: {
    type: String,
    trim: true,
  },

  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
  },

  sellingPrice: {
    type: Number,
    required: true,
    min: 0,
  },

  discount: {
    type: {
      type: String,
      enum: ["FLAT", "PERCENT"],
      default: "FLAT",
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true,
  }

}, { _id: true });


/* =========================
   MODEL SCHEMA
   (Different models under same product)
========================= */
const modelSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: String,

  variations: [variationSchema],

  images: [imageSchema],

  isActive: {
    type: Boolean,
    default: true,
  }

}, { _id: true });


/* =========================
   ITEM (MAIN PRODUCT)
========================= */
const itemSchema = new mongoose.Schema({

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },

  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Distributor",
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

  models: [modelSchema],

  images: [imageSchema], // Product level images

  isActive: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });


/* =========================
   INDEXES
========================= */

// SKU unique per shop
ProductSchema.index(
  { shop: 1, "models.variations.sku": 1 },
  { unique: true }
);

// Fast search
ProductSchema.index({ name: "text" });

module.exports = mongoose.model("Product", ProductSchema);
