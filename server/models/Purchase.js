const mongoose = require("mongoose");

/* =========================
   PURCHASE ITEM (Embedded)
========================= */
const purchaseItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",   // future me Product kar sakte ho
    required: true,
  },

modelId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Model",
  required: true,
},

variationId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Variation",
  required: true,
},

  sku: {
    type: String,
    required: true,
    trim: true,
  },

  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  freeQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },

  purchasePrice: {
    type: Number,
    required: true,
    min: 0,
  },

  taxPercent: {
    type: Number,
    default: 0,
  },

  discountAmount: {
    type: Number,
    default: 0,
  },

  totalAmount: {
    type: Number,
    required: true,
  },

}, { _id: false });


/* =========================
   MAIN PURCHASE SCHEMA
========================= */
const purchaseSchema = new mongoose.Schema({

  /* ===== MULTI SHOP ===== */
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
    index: true,
  },

  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Distributor",
    required: true,
  },

  purchaseNumber: {
    type: String,
    required: true,
  },

  invoiceNumber: {
    type: String,
    trim: true,
  },

  invoiceDate: {
    type: Date,
  },

  items: [purchaseItemSchema],

  totalQuantity: {
    type: Number,
    required: true,
  },

  subTotal: {
    type: Number,
    required: true,
  },

  totalTax: {
    type: Number,
    default: 0,
  },

  totalDiscount: {
    type: Number,
    default: 0,
  },

  grandTotal: {
    type: Number,
    required: true,
  },

  paidAmount: {
    type: Number,
    default: 0,
  },

  dueAmount: {
    type: Number,
    default: 0,
  },

  paymentStatus: {
    type: String,
    enum: ["PAID", "PARTIAL", "UNPAID"],
    default: "UNPAID",
  },

  status: {
    type: String,
    enum: ["DRAFT", "CONFIRMED", "CANCELLED"],
    default: "DRAFT",
  },

  notes: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }

}, { timestamps: true });


/* ===== UNIQUE PURCHASE NUMBER PER SHOP ===== */
purchaseSchema.index(
  { shop: 1, purchaseNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);