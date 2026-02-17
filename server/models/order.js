// const mongoose = require('mongoose');

// const orderSchema = new mongoose.Schema({
//   customer: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Customer', 
//     required: true,
//   },
//   items: [{ 
//     product: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Item', 
//       required: true,
//     },
//     quantity: {
//       type: Number,
//       required: true,
//     },
//     productDetails: {
//       type: mongoose.Schema.Types.Mixed,
//     },
//   }],
//   totalQuantity: {
//     type: Number,
//     required: true,
//   },
//   totalAmount: {
//     type: Number,
//     required: true,
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now,
//   },
// });

// const Order = mongoose.model('Order', orderSchema);
// module.exports = Order;





// ===============> old one










const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({

  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true,
  },

  modelId: {
    type: mongoose.Schema.Types.ObjectId,
  },

  variationId: {
    type: mongoose.Schema.Types.ObjectId,
  },

  sku: {
    type: String,
    required: true,
  },

  modelName: String,

  variation: {
    color: String,
    size: String,
  },

  purchasePrice: Number,   // snapshot (important for profit calculation)

  sellingPrice: {
    type: Number,
    required: true,
  },

  discountAmount: {
    type: Number,
    default: 0,
  },

  quantity: {
    type: Number,
    required: true,
  },

  totalPrice: {
    type: Number,
    required: true,
  },

}, { _id: false });

const orderSchema = new mongoose.Schema({

  /* ===== Multi Shop Support ===== */
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true,
  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
  },

  items: [orderItemSchema],

  totalQuantity: {
    type: Number,
    required: true,
  },

  subTotal: {
    type: Number,
    required: true,
  },

  totalDiscount: {
    type: Number,
    default: 0,
  },

  taxAmount: {
    type: Number,
    default: 0,
  },

  totalAmount: {
    type: Number,
    required: true,
  },

  orderSource: {
    type: String,
    enum: ["POS", "ONLINE"],
    default: "ONLINE",
  },

  orderStatus: {
    type: String,
    enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"],
    default: "PENDING",
  },

  paymentStatus: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
    default: "PENDING",
  },

  paymentMethod: {
    type: String,
    enum: ["CASH", "UPI", "CARD", "BANK_TRANSFER"],
  },

}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
