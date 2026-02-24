const purchaseItemSchema = new mongoose.Schema({

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },

  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductModel",
    required: true,
  },

  variation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariation",
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
  },

  purchasePrice: {
    type: Number,
    required: true,
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
    default: 0,
  },

}, { _id: false });