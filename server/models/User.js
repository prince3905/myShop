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

  lastLogin: Date,

  twoFactorEnabled: {
    type: Boolean,
    default: false
  },

  sessions: [{
    sid: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      default: "Unknown"
    },
    ip: {
      type: String,
      default: "Unknown"
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  }],

  notificationSettings: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    inApp: { type: Boolean, default: true }
  },

  preferences: {
    language: { type: String, default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    currency: { type: String, default: "INR" },
    dateFormat: { type: String, default: "DD/MM/YYYY" }
  },

  auditLogs: [{
    action: { type: String, required: true },
    details: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }
  }]

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
