const mongoose = require("mongoose");

/* =========================
   SALE ITEM SCHEMA
========================= */
const saleItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },

    // Variation reference (safe future proof)
    variationId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    variationSku: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Freeze purchase price at time of sale (profit calculation)
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Selling price at time of sale
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Per item discount (for bargaining)
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountType: {
      type: String,
      enum: ["FLAT", "PERCENT"],
      default: "FLAT",
    },

    total: {
      type: Number,
      required: true,
    },
  },
  { _id: true }
);

/* =========================
   SALE MAIN SCHEMA
========================= */
const saleSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    items: [saleItemSchema],

    totalQuantity: {
      type: Number,
      required: true,
    },

    subTotal: {
      type: Number,
      required: true,
    },

    // Bill level discount (example: total bill me 500 kam karo)
    billDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "CREDIT"],
      default: "CASH",
    },

    orderSource: {
      type: String,
      enum: ["POS", "ONLINE"],
      default: "POS",
    },

    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED", "RETURNED"],
      default: "COMPLETED",
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES (Performance)
========================= */

saleSchema.index({ shop: 1, createdAt: -1 });
saleSchema.index({ orderSource: 1 });

module.exports = mongoose.model("Sale", saleSchema);
