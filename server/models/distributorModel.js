const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  stockQuantity: { type: Number, required: true }, // Add stock quantity here
  // other item fields
});

const distributorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  shopName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (email) {
        const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
        return emailRegex.test(email);
      },
      message: (props) => `${props.value} is not a valid email address!`,
    },
  },
  phone: 
    {
      type: String,
      required: true,
    },
    telephone: 
    {
      type: String,
    },
  address: String,
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
  createdAt: { type: Date, default: Date.now },

  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  

  status: {
    type: String,
    enum: ['active','disabled'], // or ['active','inactive'] based on prior code
    default: 'active'
  }
});

const Distributor = mongoose.model("Distributor", distributorSchema);
module.exports = Distributor;
