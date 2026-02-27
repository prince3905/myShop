const express = require("express");
const app = express();
const cors = require("cors");

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


//Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));


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


module.exports = app;
