const express = require("express");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const app = express();
const cors = require("cors");
const logger = require("./utils/logger");

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS
  || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4200,http://127.0.0.1:4200,capacitor://localhost,http://localhost"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedConnectSources = ["'self'", ...allowedOrigins];

const dynamicOriginPatterns = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok-free\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.ngrok-dev\.app$/i,
  /^https:\/\/[a-z0-9.-]+\.onrender\.com$/i,
  /^capacitor:\/\/localhost$/i,
  /^ionic:\/\/localhost$/i,
  /^https:\/\/[a-z0-9.-]+\.railway\.app$/i,
];

const authWindowMs = 15 * 60 * 1000;
const authMaxRequests = 20;
const isDevelopment = `${process.env.NODE_ENV || "development"}` !== "production";

// Import rate limiters
const { authRateLimit, salesRateLimit, userRateLimit, customerRateLimit, generalRateLimit } = require("./middleware/rateLimiter");

const shopRouter = require("./routes/shopRoutes");
const shopSyncRoutes = require("./routes/shopSyncRoutes");
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
const fraudDetectionRoutes = require("./routes/fraudDetectionRoutes");


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
      logger.warn(`CORS blocked for origin: ${origin}`);
      return callback(new Error("CORS blocked"));
    },
    credentials: false,
  }),
);

// Request logging middleware (logs all HTTP requests)
app.use(logger.requestLogger);
app.use(
  helmet({
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com", "https://maxcdn.bootstrapcdn.com", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maxcdn.bootstrapcdn.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://maxcdn.bootstrapcdn.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: allowedConnectSources,
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
          },
        },
    crossOriginEmbedderPolicy: false, // Needed for some frontend assets
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use("/api/users/login", authRateLimit);


app.use("/api/shops", shopRouter);
app.use("/api/shops/sync", shopSyncRoutes);
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
app.use("/api/fraud-detection", fraudDetectionRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// ========================================
// GLOBAL ERROR HANDLER MIDDLEWARE
// Catches all unhandled errors and prevents server crashes
// ========================================
app.use((err, req, res, next) => {
  // Log error for debugging (never expose to client)
  logger.error("Unhandled Error", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
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
  logger.error("Unhandled Rejection", {
    promise: promise,
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  // Don't exit - keep server running
});

// Handle uncaught exceptions (last resort)
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
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
