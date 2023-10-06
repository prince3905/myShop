const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer', 
    required: true,
  },
  items: [{ 
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item', 
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    productDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
  }],
  totalQuantity: {
    type: Number,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
