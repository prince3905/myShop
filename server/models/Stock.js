const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({

  /* ===== SHOP LEVEL ===== */
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true,
  },

  /* ===== PRODUCT RELATION ===== */
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true,
  },

  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductModel",
    required: true,
  },

  variation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariation",
    required: true,
    index: true,
  },

  sku: {
    type: String,
    required: true,
    trim: true,
  },

  /* ===== STOCK NUMBERS ===== */

  quantity: {
    type: Number,
    default: 0,
    min: 0,
  },

  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },

  damagedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },

  lastPurchasePrice: {
    type: Number,
    default: 0,
  },

  reorderLevel: {
    type: Number,
    default: 0,
  }

}, { timestamps: true });

/* ===== UNIQUE STOCK PER SHOP + VARIATION ===== */
stockSchema.index(
  { shop: 1, variation: 1 },
  { unique: true }
);

/* ===== VIRTUAL AVAILABLE STOCK ===== */
stockSchema.virtual("availableQuantity").get(function () {
  const available =
    this.quantity - this.reservedQuantity - this.damagedQuantity;

  return available < 0 ? 0 : available;
});

stockSchema.set("toJSON", { virtuals: true });
stockSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Stock", stockSchema);