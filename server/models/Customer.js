

const mongoose = require('mongoose');

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
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },

  phone: {
    type: String,
    required: true,
    unique: true,
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

module.exports = mongoose.model('Customer', customerSchema);
