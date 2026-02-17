const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({

  /* ===== SHOP LEVEL ===== */
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true,
  },

  /* ===== PRODUCT ===== */
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
    index: true,
  },

  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  variationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
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

}, { timestamps: true });

/* ===== UNIQUE STOCK PER SHOP + SKU ===== */
stockSchema.index({ shop: 1, sku: 1 }, { unique: true });

/* ===== VIRTUAL AVAILABLE STOCK ===== */
stockSchema.virtual("availableQuantity").get(function () {
  const available =
    this.quantity - this.reservedQuantity - this.damagedQuantity;

  return available < 0 ? 0 : available;
});

/* Include virtuals in JSON */
stockSchema.set("toJSON", { virtuals: true });
stockSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Stock", stockSchema);
