const mongoose = require("mongoose");

// User Schema
const userSchema = mongoose.Schema({
  
  phoneNo: {
    type: String,
  },
  userType: {
    type: String,
  },

  email: {
    type: String,
  },
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  addresses: {
    state: {
      type: String,
    },
    district: {
      type: String,
    },
    village: {
      type: String,
    },
    pincode: {
      type: Number,
    },
    addressL1: {
      type: String,
    },
    addressL2: {
      type: String,
    },
  },
  pEmail: {
    type: String,
  },
  pFname: {
    type: String,
  },
  pLname: {
    type: String,
  },
  pPhoneNo: {
    type: String,
  },
});

const User = mongoose.model('User', userSchema);
module.exports = User;
