

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
  }

}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
