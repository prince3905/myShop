const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    trim: true, // Remove extra spaces from email
    lowercase: true, // Convert email to lowercase
    validate: {
      validator: function (email) {
        const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
        return emailRegex.test(email);
      },
      message: props => `${props.value} is not a valid email address!`
    },
  },
  phone: {
    type: Number,
    required: true,
    unique: true,
    validate: {
      validator: function (phone) {
        const phoneRegex = /^[0-9]{10}$/;
        return phoneRegex.test(phone);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
  },
  address: String,
  createdAt: { type: Date, default: Date.now },
});

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
