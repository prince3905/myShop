const Sale = require("../models/CustomerSale");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Shop = require("../models/Shop");
const Stock = require("../models/Stock");
const Distributor = require("../models/Distributor");
const Purchase = require("../models/Purchase");
const SaleReturn = require("../models/SaleReturn");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

exports.getKpis = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [salesAgg, todayOrders, activeShops, totalCustomers, lowStockCount, distributorDueAgg, todayPurchaseAgg, todayReturnAgg] =
      await Promise.all([
        Sale.aggregate([
          { $match: { ...query, createdAt: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, salesCount: { $sum: 1 } } },
        ]),
        Order.countDocuments({ ...query, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
        isSuperAdminGlobal(req)
          ? Shop.countDocuments({ isActive: true })
          : Promise.resolve(req.shopId ? 1 : 0),
        Customer.countDocuments({ ...query, isActive: { $ne: false } }),
        Stock.countDocuments({
          ...query,
          $expr: { $lte: ["$quantity", "$reorderLevel"] },
        }),
        Distributor.aggregate([
          { $match: { ...query, isDeleted: { $ne: true } } },
          { $group: { _id: null, totalDue: { $sum: "$currentBalance" } } },
        ]),
        Purchase.aggregate([
          {
            $match: {
              ...query,
              status: "CONFIRMED",
              confirmedAt: { $gte: startOfDay, $lte: endOfDay },
            },
          },
          { $group: { _id: null, totalPurchase: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
        ]),
        SaleReturn.aggregate([
          { $match: { ...query, createdAt: { $gte: startOfDay, $lte: endOfDay } } },
          {
            $group: {
              _id: null,
              totalReturnAmount: { $sum: "$totalAmount" },
              totalRefundAmount: { $sum: "$refundAmount" },
              totalCreditAmount: { $sum: "$creditAmount" },
              totalReturnQty: { $sum: "$totalQuantity" },
              returnCount: { $sum: 1 },
            },
          },
        ]),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        todaySales: Number(salesAgg[0]?.totalRevenue || 0),
        todaySalesCount: Number(salesAgg[0]?.salesCount || 0),
        todayOrders: Number(todayOrders || 0),
        todayPurchase: Number(todayPurchaseAgg[0]?.totalPurchase || 0),
        todayPurchaseCount: Number(todayPurchaseAgg[0]?.count || 0),
        todayReturnAmount: Number(todayReturnAgg[0]?.totalReturnAmount || 0),
        todayRefundAmount: Number(todayReturnAgg[0]?.totalRefundAmount || 0),
        todayCreditAmount: Number(todayReturnAgg[0]?.totalCreditAmount || 0),
        todayReturnQty: Number(todayReturnAgg[0]?.totalReturnQty || 0),
        todayReturnCount: Number(todayReturnAgg[0]?.returnCount || 0),
        activeShops: Number(activeShops || 0),
        totalCustomers: Number(totalCustomers || 0),
        lowStockCount: Number(lowStockCount || 0),
        distributorDue: Number(distributorDueAgg[0]?.totalDue || 0),
        mode: isSuperAdminGlobal(req) ? "GLOBAL" : "SHOP_WISE",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard KPIs",
      error: error.message,
    });
  }
};

exports.getReturnAnalytics = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const buildMatch = (start) => ({
      ...query,
      createdAt: { $gte: start, $lte: now },
    });

    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      SaleReturn.aggregate([
        { $match: buildMatch(startOfDay) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            refund: { $sum: "$refundAmount" },
            credit: { $sum: "$creditAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      SaleReturn.aggregate([
        { $match: buildMatch(startOfWeek) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            refund: { $sum: "$refundAmount" },
            credit: { $sum: "$creditAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      SaleReturn.aggregate([
        { $match: buildMatch(startOfMonth) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            refund: { $sum: "$refundAmount" },
            credit: { $sum: "$creditAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const normalize = (row) => ({
      totalAmount: Number(row?.amount || 0),
      totalRefund: Number(row?.refund || 0),
      totalCredit: Number(row?.credit || 0),
      totalQty: Number(row?.qty || 0),
      count: Number(row?.count || 0),
    });

    return res.status(200).json({
      success: true,
      data: {
        today: normalize(todayAgg[0]),
        weekly: normalize(weekAgg[0]),
        monthly: normalize(monthAgg[0]),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load return analytics",
      error: error.message,
    });
  }
};

exports.getTrends = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const days = Math.min(30, Math.max(7, Number(req.query.days || 7)));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [salesAgg, purchaseAgg, orderAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { ...query, createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            total: { $sum: "$totalAmount" },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: { ...query, status: "CONFIRMED", confirmedAt: { $gte: start } } },
        {
          $group: {
            _id: {
              y: { $year: "$confirmedAt" },
              m: { $month: "$confirmedAt" },
              d: { $dayOfMonth: "$confirmedAt" },
            },
            total: { $sum: "$grandTotal" },
          },
        },
      ]),
      Order.aggregate([
        { $match: { ...query, createdAt: { $gte: start } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const dateKeys = [];
    const labels = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
      dateKeys.push(key);
      labels.push(
        dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      );
    }

    const salesMap = new Map(
      salesAgg.map((r) => [`${r._id.y}-${r._id.m}-${r._id.d}`, Number(r.total || 0)]),
    );
    const purchaseMap = new Map(
      purchaseAgg.map((r) => [`${r._id.y}-${r._id.m}-${r._id.d}`, Number(r.total || 0)]),
    );
    const orderMap = new Map(
      orderAgg.map((r) => [`${r._id.y}-${r._id.m}-${r._id.d}`, Number(r.count || 0)]),
    );

    return res.status(200).json({
      success: true,
      data: {
        labels,
        sales: dateKeys.map((k) => salesMap.get(k) || 0),
        purchase: dateKeys.map((k) => purchaseMap.get(k) || 0),
        orders: dateKeys.map((k) => orderMap.get(k) || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard trends",
      error: error.message,
    });
  }
};

exports.getPurchaseAnalytics = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const buildMatch = (start) => ({
      ...query,
      status: "CONFIRMED",
      confirmedAt: { $gte: start, $lte: now },
    });

    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      Purchase.aggregate([
        { $match: buildMatch(startOfDay) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$grandTotal" },
            paid: { $sum: "$paidAmount" },
            due: { $sum: "$dueAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: buildMatch(startOfWeek) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$grandTotal" },
            paid: { $sum: "$paidAmount" },
            due: { $sum: "$dueAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: buildMatch(startOfMonth) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$grandTotal" },
            paid: { $sum: "$paidAmount" },
            due: { $sum: "$dueAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const normalize = (row) => ({
      totalAmount: Number(row?.amount || 0),
      totalPaid: Number(row?.paid || 0),
      totalDue: Number(row?.due || 0),
      count: Number(row?.count || 0),
    });

    return res.status(200).json({
      success: true,
      data: {
        today: normalize(todayAgg[0]),
        weekly: normalize(weekAgg[0]),
        monthly: normalize(monthAgg[0]),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load purchase analytics",
      error: error.message,
    });
  }
};
