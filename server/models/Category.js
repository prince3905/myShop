
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: String,

  image: String,

  brands: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
  }],

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

categorySchema.index({ shop: 1, name: 1 }, { unique: true });
categorySchema.index({ shop: 1 });

module.exports = mongoose.model('Category', categorySchema);
