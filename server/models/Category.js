
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: String,

  image: String,

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  },

  isActive: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });

categorySchema.index({ name: 1, shop: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
