// item.js (Mongoose schema for Item)
const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true,
  },
  p_price: {
    type: Number,
    required: true,
  },
  s_price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  model: {
    type: String,
  },
  color: {
    type: String,
  },
  size: {
    type: String,
  },
  description: String,
  createdAt: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Item', itemSchema);
