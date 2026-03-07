const mongoose = require('mongoose');

const normalizePhoneValue = (value) => {
  const digits = `${value || ""}`.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const normalizeEmailValue = (value) => `${value || ""}`.trim().toLowerCase();

const customerSchema = new mongoose.Schema({

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    sparse: true,
    trim: true,
    lowercase: true,
  },

  phone: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (phone) {
        return /^[0-9]{10}$/.test(phone);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
  },

  address: String,

  totalPurchase: {
    type: Number,
    default: 0
  },

  totalPaid: {
    type: Number,
    default: 0
  },

  totalDue: {
    type: Number,
    default: 0
  },

  purchaseCount: {
    type: Number,
    default: 0
  },

  // Track recent purchases
  recentPurchases: [{
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerSale"
    },
    invoiceNo: String,
    items: [{
      itemName: String,
      model: String,
      quantity: Number,
      sellingPrice: Number,
      total: Number
    }],
    totalAmount: Number,
    paidAmount: Number,
    dueAmount: Number,
    paymentMethod: String,
    purchaseDate: {
      type: Date,
      default: Date.now
    }
  }],

  isActive: {
    type: Boolean,
    default: true
  },

  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },

  archivedAt: Date,

  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }

}, { timestamps: true });

customerSchema.index({ shop: 1, phone: 1 }, { unique: true });
customerSchema.index(
  { shop: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string", $ne: "" } },
  },
);

customerSchema.pre("validate", function (next) {
  this.phone = normalizePhoneValue(this.phone);
  this.email = normalizeEmailValue(this.email);
  next();
});

customerSchema.statics.normalizePhone = normalizePhoneValue;
customerSchema.statics.normalizeEmail = normalizeEmailValue;

module.exports = mongoose.model('Customer', customerSchema);
