// category.js (Mongoose schema for Category)
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
});

module.exports = mongoose.model('Category', categorySchema, 'categories');
