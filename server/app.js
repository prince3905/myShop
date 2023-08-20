const express = require("express");
const app = express();
const cors = require("cors");

const UserRoutes = require("./routes/allUsersRoutes");
const authRouter = require("./routes/authRoutes");
const itemRouter = require("./routes/itemsRoutes");
const categoryRouter = require("./routes/categoryRouter");
const brandRouter = require("./routes/brandRoutes");
const purchaseRouter = require("./routes/purchaseRoutes");
const stockRouter = require("./routes/stockRoutes");

//Middleware
app.use(cors());
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded requests

app.use("/api/user", UserRoutes);
app.use("/api/auth", authRouter);
app.use("/api/item", itemRouter);
app.use("/api/category", categoryRouter);
app.use("/api/brand", brandRouter);
app.use("/api/purchase", purchaseRouter);
app.use("/api/stock", stockRouter);

module.exports = app;
