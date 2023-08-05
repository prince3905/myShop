const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const createError = require("http-errors");
const AdminUser = require("../models/userModel");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, req, res) => {
  try {
    const token = signToken(user._id);
    console.log(token);

    const expirationTime = Date.now() + 10 * 24 * 60 * 60 * 1000;

    res.cookie("jwt", token, {
      expires: new Date(expirationTime),
      httpOnly: true,
      secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    });

    // // Remove password from output
    // user.password = undefined;

    res.status(statusCode).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.log(error);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      throw createError(400, "Please provide email and password");
    }

    const adminUser = await AdminUser.findOne({ email }).select("+password");
    console.log(adminUser);

    if (!adminUser) {
      throw createError(404, "User not registered");
    }

    // Compare the user's provided password with the hashed password from the database
    const passwordMatch = await bcrypt.compare(password, adminUser.password);
    if (!passwordMatch) {
      throw createError(401, "Incorrect password");
    }

    createSendToken(adminUser, 200, req, res);
  } catch (error) {
    next(error);
  }
};

exports.protect = async (req, res, next) => {
  // 1) Getting token and check of it's there
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next("You are not logged in! Please log in to get access.", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await AdminUser.findById(decoded.id);

    if (!currentUser) {
      return next(
        "The user belonging to this token does no longer exist.",
        401
      );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;

    next();
  } catch (error) {
    // Handle the error here
    if (error.name === "TokenExpiredError") {
      return next("Your session has expired. Please log in again.", 401);
    }
    if (error.name === "JsonWebTokenError") {
      return next("Invalid token. Please provide a valid token.", 401);
    }
    console.error("Error in protect middleware:", error);
    res.status(401).json({ error: "Unauthorized" });
  }
};

exports.checkAuthentication = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next("You are not logged in! Please log in to get access.", 401);
  }

  // 2) Verification token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await AdminUser.findById(decoded.id);

  if (!currentUser) {
    return next("The user belonging to this token does no longer exist.", 401);
  }

  res.status(200).json({
    success: true,
    user: currentUser,
  });
};

exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "You are logged out",
  });
};
