const express = require("express");
const app = express();
const cors = require("cors");

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:4200,http://127.0.0.1:4200")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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


//Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
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


module.exports = app;
