const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.login = async (req, res) => {
  try {
    const { shopCode, email, password } = req.body;

    if (!shopCode || !email || !password) {
      return res.status(400).json({
        message: "Shop Code, Email and Password required",
      });
    }

    // Find shop by shopCode
    const shop = await require("../models/Shop").findOne({
      shopCode: shopCode.toUpperCase(),
      isActive: true,
    });

    if (!shop) {
      return res.status(404).json({
        message: "Shop not found",
      });
    }

    // Find user inside that shop
    const user = await require("../models/User")
      .findOne({
        email,
        shop: shop._id,
      })
      .select("+password");

    if (!user) {
      return res.status(400).json({
        message: "User not found for this shop",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User is disabled",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Wrong password",
      });
    }

    // Generate token
    const token = require("jsonwebtoken").sign(
      {
        id: user._id,
        role: user.role,
        shop: shop._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        shop: shop._id,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, phoneNo, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      email,
      password,
      phoneNo,
      role,
    });

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};
