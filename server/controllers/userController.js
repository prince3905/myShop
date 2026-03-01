const User = require("../models/User");
const bcrypt = require("bcryptjs");



exports.createUser = async (req, res) => {
  try {
    const { email, password, phoneNo, role, shop } = req.body;

    // STAFF kisi ko create nahi karega
    if (req.user.role === "STAFF") {
      return res.status(403).json({
        message: "STAFF cannot create users"
      });
    }

    // SUPER_ADMIN hi ADMIN bana sakta hai
    if (role === "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Only SUPER_ADMIN can create ADMIN"
      });
    }

    // ADMIN hi MANAGER bana sakta hai
    if (role === "MANAGER" && !["SUPER_ADMIN", "ADMIN"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN can create MANAGER"
      });
    }

    // MANAGER ya ADMIN hi STAFF bana sakta hai
    if (role === "STAFF" && !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only ADMIN or MANAGER can create STAFF"
      });
    }

    // ADMIN apne shop ke bahar user create nahi kare
    if (req.user.role === "ADMIN" || req.user.role === "MANAGER") {
      if (shop && shop.toString() !== req.user.shop?.toString()) {
        return res.status(403).json({
          message: "You can create users only in your own shop"
        });
      }
    }

    const user = await User.create({
      email,
      password,
      phoneNo,
      role,
      shop
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  const filter = req.user.role === "SUPER_ADMIN" ? {} : { shop: req.user.shop };
  const users = await User.find(filter);
  res.json(users);
};
