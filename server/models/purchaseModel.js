const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
  },
  purchaseDate: {
    type: Date,
    default: Date.now,
  },
  items: [
    {
      itemName: {
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
      quantity: {
        type: Number,
        required: true,
      },
      purchasePrice: {
        type: Number,
        required: true,
      },
      model: String,
      size: String,
    },
  ],
  totalPurchasePrice: {
    type: Number,
    required: true,
  },
  totalQuantity: {
    type: Number,
    required: true,
  },
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
