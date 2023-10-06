const { model } = require("mongoose")
const mongoose = require('mongoose');

const variationSchema = new mongoose.Schema({
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
  orderNumber: {
    type: String,
    required: true,
  },
  soldOut: {
    type: Boolean
  },
});

const modelSchema = new mongoose.Schema({
  model: {
    type: String,
    required: true,
  },
  color: String,
  size: String,
  description: String,
  variations: [variationSchema],
});

const itemSchema = new mongoose.Schema({
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
    required: true,
  },
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
  models: [modelSchema],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Item', itemSchema);