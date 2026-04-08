const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const cors = require("cors");

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
  || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4200,http://127.0.0.1:4200,capacitor://localhost,http://localhost"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const dynamicOriginPatterns = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok-dev\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.onrender\.com$/i,
  /^capacitor:\/\/localhost$/i,
  /^ionic:\/\/localhost$/i,
];

const authWindowMs = 15 * 60 * 1000;
const authMaxRequests = 20;
const authRequestStore = new Map();

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
};

const authRateLimit = (req, res, next) => {
  const key = `${req.ip || "unknown"}:${req.path}`;
  const now = Date.now();
  const current = authRequestStore.get(key);

  if (!current || now > current.resetAt) {
    authRequestStore.set(key, { count: 1, resetAt: now + authWindowMs });
    return next();
  }

  if (current.count >= authMaxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many auth attempts. Please try again later.",
    });
  }

  current.count += 1;
  authRequestStore.set(key, current);
  return next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authRequestStore.entries()) {
    if (now > value.resetAt) {
      authRequestStore.delete(key);
    }
  }
}, authWindowMs).unref();

const shopRouter = require("./routes/shopRoutes");
const userRoutes = require("./routes/allUsersRoutes");
const authRouter = require("./routes/authRoutes");
const distributorRouter = require("./routes/distributorRoutes");
const distributorLedgerRoutes = require("./routes/distributorLedgerRoutes");
const brandRoutes = require("./routes/brandRoutes");
const categoryRoutes = require("./routes/categoryRouter");
const productRoutes = require("./routes/productRoutes");
const productModelRoutes = require("./routes/productModelRoutes");
const productVariationRoutes = require("./routes/productVariationRoutes");
const stockRoutes = require("./routes/stockRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const salesRoutes = require("./routes/salesRoutes");
const customerRouter = require("./routes/customerRouter");
const orderRoutes = require("./routes/orderRoutes");
const dailyExpenseRoutes = require("./routes/dailyExpenseRoutes");
const staffRoutes = require("./routes/staffRoutes");
const staffWorkTypeRoutes = require("./routes/staffWorkTypeRoutes");
const staffWorkItemRoutes = require("./routes/staffWorkItemRoutes");
const staffPaymentRoutes = require("./routes/staffPaymentRoutes");
const staffDailyWorkRoutes = require("./routes/staffDailyWorkRoutes");
const factoryProductRoutes = require("./routes/factoryProductRoutes");
const rawMaterialRoutes = require("./routes/rawMaterialRoutes");
const rawMaterialPurchaseRoutes = require("./routes/rawMaterialPurchaseRoutes");


//Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin
        || allowedOrigins.includes(origin)
        || dynamicOriginPatterns.some((pattern) => pattern.test(origin))
      ) {
        return callback(null, true);
      }
      console.error(`CORS blocked for origin: ${origin}`);
      return callback(new Error("CORS blocked"));
    },
    credentials: false,
  }),
);
app.use(securityHeaders);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use("/api/users/login", authRateLimit);


app.use("/api/shops", shopRouter);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRouter);
app.use("/api/distributor", distributorRouter);
app.use("/api/distributor-ledger", distributorLedgerRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-models", productModelRoutes);
app.use("/api/product-variations", productVariationRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/purchase", salesRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/customer", customerRouter);
app.use("/api/order", orderRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/daily-expenses", dailyExpenseRoutes);
app.use("/api/staffs", staffRoutes);
app.use("/api/staff-work-types", staffWorkTypeRoutes);
app.use("/api/staff-work-items", staffWorkItemRoutes);
app.use("/api/staff-payments", staffPaymentRoutes);
app.use("/api/staff-daily-work", staffDailyWorkRoutes);
app.use("/api/factory-products", factoryProductRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/raw-material-purchases", rawMaterialPurchaseRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// Catches all unhandled errors and prevents server crashes
// ========================================
app.use((err, req, res, next) => {
  // Log error for debugging (never expose to client)
  console.error("Unhandled Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry. This record already exists.",
    });
  }

  // MongoDB validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  // MongoDB cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // JSON Web Token errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please login again.",
    });
  }

  // Default: Generic server error
  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error. Please try again later." : err.message || "Something went wrong",
  });
});

// Handle unhandled promise rejections (prevent server crash)
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", {
    promise: promise,
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  // Don't exit - keep server running
});

// Handle uncaught exceptions (last resort)
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
  });
  // Graceful shutdown
  process.exit(1);
});

const resolveClientDistPath = () => {
  const candidates = [
    path.join(__dirname, "public"),
    path.join(__dirname, "..", "client", "server", "public"),
    path.join(__dirname, "..", "client", "babaShop", "dist"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  return candidates[0];
};

const clientDistPath = resolveClientDistPath();
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  return res.sendFile(path.join(clientDistPath, "index.html"));
});

module.exports = app;
