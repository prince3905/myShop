const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({

  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },

  modelId: mongoose.Schema.Types.ObjectId,
  variationId: mongoose.Schema.Types.ObjectId,

  sku: String,

  model: String,
  color: String,
  size: String,

  quantity: {
    type: Number,
    required: true,
  },

  purchasePrice: Number,   // important for purchase return
  sellingPrice: Number,    // important for sales return

  totalAmount: {
    type: Number,
    required: true,
  },

  reason: {
    type: String,
    enum: [
      'DAMAGED',
      'EXPIRED',
      'WRONG_ITEM',
      'CUSTOMER_RETURN',
      'OTHER'
    ],
    required: true,
  },

}, { _id: false });

const returnSchema = new mongoose.Schema({

  /* ===== Multi Shop Support ===== */
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
  },

  returnType: {
    type: String,
    enum: ['PURCHASE', 'SALES'],
    required: true,
  },

  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },

  items: [returnItemSchema],

  totalQuantity: {
    type: Number,
    required: true,
  },

  totalRefundAmount: {
    type: Number,
    required: true,
  },

  stockEffect: {
    type: String,
    enum: ['INCREASE', 'DECREASE'],
    required: true,
  },

  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },

  notes: String,

  isActive: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });

module.exports = mongoose.model('Return', returnSchema);
