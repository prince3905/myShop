const mongoose = require("mongoose");
// const bcrypt = require('bcryptjs');

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
  createdAt: { type: Date, default: Date.now } 
});

// userSchema.methods.correctPassword = async (
//   candidatePassword,
//   userPassword
// ) => {
//   return await bcrypt.compare(candidatePassword, userPassword);
//   console.log(candidatePassword,userPassword)
//   console.log("from modals")
// };

const User = mongoose.model('User', userSchema);
module.exports = User;
