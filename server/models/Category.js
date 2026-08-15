const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: String,

  image: String,

  icon: {
    type: String,
    default: "folder",
    trim: true
  },

  brands: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
  }],

  shops: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Shop",
    required: true,
  },

  ownerShop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });

categorySchema.index({ name: 1 });
categorySchema.index({ ownerShop: 1 });
categorySchema.index({ shops: 1 });

module.exports = mongoose.model('Category', categorySchema);