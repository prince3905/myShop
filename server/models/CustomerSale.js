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

    // Snapshot fields for legacy/UI display stability
    itemName: {
      type: String,
      trim: true,
    },

    model: {
      type: String,
      trim: true,
    },

    size: {
      type: String,
      trim: true,
    },

    color: {
      type: String,
      trim: true,
    },

    categoryName: {
      type: String,
      trim: true,
    },

    brandName: {
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

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
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

    // Legacy sales screen uses customerName directly
    customerName: {
      type: String,
      trim: true,
      index: true,
    },

    invoiceNo: {
      type: String,
      trim: true,
      index: true,
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
      enum: ["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT"],
      default: "CASH",
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    returnedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dueAdjustedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    creditedAmount: {
      type: Number,
      default: 0,
      min: 0,
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
saleSchema.index(
  { shop: 1, invoiceNo: 1 },
  { unique: true, partialFilterExpression: { invoiceNo: { $type: "string", $ne: "" } } },
);

module.exports = mongoose.model("Sale", saleSchema);
