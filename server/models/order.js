const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      trim: true,
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
      trim: true,
    },
    modelName: {
      type: String,
      trim: true,
    },
    variation: {
      color: String,
      size: String,
    },
    purchasePrice: Number,
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
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    deliveryContactName: {
      type: String,
      trim: true,
      default: "",
    },
    deliveryPhone: {
      type: String,
      trim: true,
      default: "",
    },
    deliveryAddress: {
      type: String,
      trim: true,
      default: "",
    },
    deliveryNote: {
      type: String,
      trim: true,
      default: "",
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    orderNo: {
      type: String,
      trim: true,
      index: true,
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
    paidAmount: {
      type: Number,
      default: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
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
    paymentNote: {
      type: String,
      trim: true,
      default: "",
    },
    paymentCollectedAt: {
      type: Date,
      default: null,
    },
    stockApplied: {
      type: Boolean,
      default: false,
    },
    stockAppliedAt: {
      type: Date,
      default: null,
    },
    stockReleasedAt: {
      type: Date,
      default: null,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

orderSchema.index({ shop: 1, createdAt: -1 });
orderSchema.index(
  { shop: 1, orderNo: 1 },
  {
    unique: true,
    partialFilterExpression: { orderNo: { $type: "string", $ne: "" } },
  },
);

module.exports = mongoose.model("Order", orderSchema);
