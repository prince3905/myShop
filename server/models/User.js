// const mongoose = require("mongoose");
// // const bcrypt = require('bcryptjs');

// // User Schema
// const userSchema = mongoose.Schema({
  
//   phoneNo: {
//     type: String,
//   },
//   userType: {
//     type: String,
//   },

//   email: {
//     type: String,
//   },
//   email: {
//     type: String,
//   },
//   password: {
//     type: String,
//   },
//   addresses: {
//     state: {
//       type: String,
//     },
//     district: {
//       type: String,
//     },
//     village: {
//       type: String,
//     },
//     pincode: {
//       type: Number,
//     },
//     addressL1: {
//       type: String,
//     },
//     addressL2: {
//       type: String,
//     },
//   },
//   pEmail: {
//     type: String,
//   },
//   pFname: {
//     type: String,
//   },
//   pLname: {
//     type: String,
//   },
//   pPhoneNo: {
//     type: String,
//   },
//   createdAt: { type: Date, default: Date.now } 
// });

// // userSchema.methods.correctPassword = async (
// //   candidatePassword,
// //   userPassword
// // ) => {
// //   return await bcrypt.compare(candidatePassword, userPassword);
// //   console.log(candidatePassword,userPassword)
// //   console.log("from modals")
// // };

// const User = mongoose.model('User', userSchema);
// module.exports = User;



const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema({
  state: String,
  district: String,
  village: String,
  pincode: Number,
  addressL1: String,
  addressL2: String,
  isDefault: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const userSchema = new mongoose.Schema({

  phoneNo: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true
  },

  password: {
    type: String,
    required: true,
    select: false
  },

 role: {
  type: String,
  enum: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"],
  default: "STAFF"
},

  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop"
  },

  addresses: [addressSchema],

  pEmail: String,
  pFname: String,
  pLname: String,
  pPhoneNo: String,

  isActive: {
    type: Boolean,
    default: true
  },

  isEmailVerified: {
    type: Boolean,
    default: false
  },

  lastLogin: Date

}, { timestamps: true });

/* Compound Index */
userSchema.index({ phoneNo: 1, shop: 1 }, { unique: true });

/* Password Hash */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/* Compare Password */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
