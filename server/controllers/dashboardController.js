const Sale = require("../models/CustomerSale");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Shop = require("../models/Shop");
const Stock = require("../models/Stock");
const Distributor = require("../models/Distributor");
const Purchase = require("../models/Purchase");
const SaleReturn = require("../models/SaleReturn");
const PurchaseReturn = require("../models/PurchaseReturn");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitiveFinancials = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const canViewOperationalAmounts = (req) =>
  ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${req.user?.role || ""}`);

exports.getOverview = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const allowFinancials = canViewSensitiveFinancials(req);
    const allowOperationalAmounts = canViewOperationalAmounts(req);

    const [
      lowStockItems,
      recentOrders,
      recentSales,
      topSellingProducts,
      recentSalePayments,
      recentOrderPayments,
      salesDueAgg,
      orderDueAgg,
      customerDueAgg,
      customerWalletAgg,
      saleCreditAgg,
      walletUsedAgg,
    ] = await Promise.all([
      Stock.find(query)
        .populate("product", "name")
        .sort({ quantity: 1, updatedAt: -1 })
        .limit(5)
        .lean(),
      Order.find(query)
        .select("orderNo totalAmount dueAmount orderStatus orderSource createdAt paymentStatus customer")
        .populate("customer", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Sale.find(query)
        .select("invoiceNo customerName totalAmount dueAmount paymentMethod status createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Sale.aggregate([
        { $match: { ...query, status: { $ne: "CANCELLED" } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              item: "$items.item",
              itemName: "$items.itemName",
              model: "$items.model",
            },
            totalQty: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { totalQty: -1, totalRevenue: -1 } },
        { $limit: 5 },
      ]),
      Sale.find({ ...query, paidAmount: { $gt: 0 }, status: { $ne: "CANCELLED" } })
        .select("invoiceNo customerName paidAmount paymentMethod createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Order.find({ ...query, paidAmount: { $gt: 0 } })
        .select("orderNo paidAmount paymentMethod paymentCollectedAt createdAt customer")
        .populate("customer", "name")
        .sort({ paymentCollectedAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      allowFinancials
        ? Sale.aggregate([
            { $match: { ...query, dueAmount: { $gt: 0 }, status: { $ne: "CANCELLED" } } },
            {
              $group: {
                _id: null,
                totalDue: { $sum: "$dueAmount" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      allowFinancials
        ? Order.aggregate([
            {
              $match: {
                ...query,
                dueAmount: { $gt: 0 },
                orderStatus: { $nin: ["CANCELLED", "RETURNED"] },
              },
            },
            {
              $group: {
                _id: null,
                totalDue: { $sum: "$dueAmount" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      allowFinancials
        ? Customer.aggregate([
            {
              $match: {
                ...query,
                isDeleted: { $ne: true },
                totalDue: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                totalDue: { $sum: "$totalDue" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      allowFinancials
        ? Customer.aggregate([
            {
              $match: {
                ...query,
                isDeleted: { $ne: true },
                walletBalance: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                totalWalletBalance: { $sum: "$walletBalance" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      allowFinancials
        ? SaleReturn.aggregate([
            {
              $match: {
                ...query,
                status: "APPROVED",
                creditAmount: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                totalCreditIssued: { $sum: "$creditAmount" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      allowFinancials
        ? Sale.aggregate([
            {
              $match: {
                ...query,
                status: { $ne: "CANCELLED" },
                walletUsedAmount: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                totalWalletUsed: { $sum: "$walletUsedAmount" },
                count: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        lowStockItems: lowStockItems.map((stock) => ({
          id: stock._id,
          productName: stock.product?.name || "Unnamed Product",
          sku: stock.sku || "-",
          quantity: Number(stock.quantity || 0),
          reservedQuantity: Number(stock.reservedQuantity || 0),
          damagedQuantity: Number(stock.damagedQuantity || 0),
          reorderLevel: Number(stock.reorderLevel || 0),
          availableQuantity: Math.max(
            0,
            Number(stock.quantity || 0) -
              Number(stock.reservedQuantity || 0) -
              Number(stock.damagedQuantity || 0),
          ),
        })),
        recentOrders: recentOrders.map((order) => ({
          id: order._id,
          orderNo: order.orderNo || "-",
          customerName: order.customer?.name || "Walk-in",
          totalAmount: allowOperationalAmounts ? Number(order.totalAmount || 0) : 0,
          dueAmount: allowOperationalAmounts ? Number(order.dueAmount || 0) : 0,
          orderStatus: order.orderStatus || "PENDING",
          paymentStatus: order.paymentStatus || "PENDING",
          orderSource: order.orderSource || "ONLINE",
          createdAt: order.createdAt,
        })),
        recentSales: recentSales.map((sale) => ({
          id: sale._id,
          invoiceNo: sale.invoiceNo || "-",
          customerName: sale.customerName || "Walk-in",
          totalAmount: allowOperationalAmounts ? Number(sale.totalAmount || 0) : 0,
          dueAmount: allowOperationalAmounts ? Number(sale.dueAmount || 0) : 0,
          paymentMethod: sale.paymentMethod || "CASH",
          status: sale.status || "COMPLETED",
          createdAt: sale.createdAt,
        })),
        topSellingProducts: topSellingProducts.map((item) => ({
          id: item._id?.item || `${item._id?.itemName || "item"}-${item._id?.model || ""}`,
          productName: item._id?.itemName || "Unnamed Product",
          modelName: item._id?.model || "",
          totalQty: Number(item.totalQty || 0),
          totalRevenue: allowOperationalAmounts ? Number(item.totalRevenue || 0) : 0,
          orders: Number(item.orders || 0),
        })),
        recentPayments: allowFinancials ? [...recentSalePayments.map((sale) => ({
          id: `sale-${sale._id}`,
          referenceNo: sale.invoiceNo || "-",
          customerName: sale.customerName || "Walk-in",
          amount: Number(sale.paidAmount || 0),
          method: sale.paymentMethod || "CASH",
          source: "SALE",
          createdAt: sale.createdAt,
        })), ...recentOrderPayments.map((order) => ({
          id: `order-${order._id}`,
          referenceNo: order.orderNo || "-",
          customerName: order.customer?.name || "Walk-in",
          amount: Number(order.paidAmount || 0),
          method: order.paymentMethod || "CASH",
          source: "ORDER",
          createdAt: order.paymentCollectedAt || order.createdAt,
        }))]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6) : [],
        dueSummary: allowFinancials
          ? {
              salesDue: Number(salesDueAgg[0]?.totalDue || 0),
              salesDueCount: Number(salesDueAgg[0]?.count || 0),
              orderDue: Number(orderDueAgg[0]?.totalDue || 0),
              orderDueCount: Number(orderDueAgg[0]?.count || 0),
              customerDue: Number(customerDueAgg[0]?.totalDue || 0),
              customerDueCount: Number(customerDueAgg[0]?.count || 0),
            }
          : null,
        customerCreditSummary: allowFinancials
          ? {
              totalWalletBalance: Number(customerWalletAgg[0]?.totalWalletBalance || 0),
              walletCustomerCount: Number(customerWalletAgg[0]?.count || 0),
              totalCreditIssued: Number(saleCreditAgg[0]?.totalCreditIssued || 0),
              creditIssueCount: Number(saleCreditAgg[0]?.count || 0),
              totalWalletUsed: Number(walletUsedAgg[0]?.totalWalletUsed || 0),
              walletUseCount: Number(walletUsedAgg[0]?.count || 0),
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard overview",
      error: error.message,
    });
  }
};

exports.getKpis = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const allowFinancials = canViewSensitiveFinancials(req);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [salesAgg, todayOrders, activeShops, totalCustomers, lowStockCount, distributorDueAgg, todayPurchaseAgg, todaySaleReturnAgg, todayPurchaseReturnAgg] =
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
        PurchaseReturn.aggregate([
          { $match: { ...query, createdAt: { $gte: startOfDay, $lte: endOfDay }, status: "APPROVED" } },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$totalAmount" },
              totalQty: { $sum: "$totalQuantity" },
              count: { $sum: 1 },
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
        todayPurchase: allowFinancials
          ? Number(todayPurchaseAgg[0]?.totalPurchase || 0)
          : 0,
        todayPurchaseCount: Number(todayPurchaseAgg[0]?.count || 0),
        todaySaleReturnAmount: Number(todaySaleReturnAgg[0]?.totalReturnAmount || 0),
        todaySaleRefundAmount: Number(todaySaleReturnAgg[0]?.totalRefundAmount || 0),
        todaySaleCreditAmount: Number(todaySaleReturnAgg[0]?.totalCreditAmount || 0),
        todaySaleReturnQty: Number(todaySaleReturnAgg[0]?.totalReturnQty || 0),
        todaySaleReturnCount: Number(todaySaleReturnAgg[0]?.returnCount || 0),
        todayPurchaseReturnAmount: Number(todayPurchaseReturnAgg[0]?.totalAmount || 0),
        todayPurchaseReturnQty: Number(todayPurchaseReturnAgg[0]?.totalQty || 0),
        todayPurchaseReturnCount: Number(todayPurchaseReturnAgg[0]?.count || 0),
        activeShops: Number(activeShops || 0),
        totalCustomers: Number(totalCustomers || 0),
        lowStockCount: Number(lowStockCount || 0),
        distributorDue: allowFinancials
          ? Number(distributorDueAgg[0]?.totalDue || 0)
          : 0,
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

exports.getPurchaseReturnAnalytics = async (req, res) => {
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
      status: "APPROVED",
      createdAt: { $gte: start, $lte: now },
    });

    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      PurchaseReturn.aggregate([
        { $match: buildMatch(startOfDay) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      PurchaseReturn.aggregate([
        { $match: buildMatch(startOfWeek) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
      PurchaseReturn.aggregate([
        { $match: buildMatch(startOfMonth) },
        {
          $group: {
            _id: null,
            amount: { $sum: "$totalAmount" },
            qty: { $sum: "$totalQuantity" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const normalize = (row) => ({
      totalAmount: Number(row?.amount || 0),
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
      message: "Failed to load purchase return analytics",
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
        purchase: canViewSensitiveFinancials(req)
          ? dateKeys.map((k) => purchaseMap.get(k) || 0)
          : dateKeys.map(() => 0),
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

    const empty = { totalAmount: 0, totalPaid: 0, totalDue: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
        today: canViewSensitiveFinancials(req) ? normalize(todayAgg[0]) : empty,
        weekly: canViewSensitiveFinancials(req) ? normalize(weekAgg[0]) : empty,
        monthly: canViewSensitiveFinancials(req) ? normalize(monthAgg[0]) : empty,
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
