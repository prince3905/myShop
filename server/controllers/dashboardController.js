const Sale = require("../models/CustomerSale");
const Order = require("../models/order");
const Customer = require("../models/Customer");
const Shop = require("../models/Shop");
const Stock = require("../models/Stock");
const Distributor = require("../models/Distributor");
const Purchase = require("../models/Purchase");
const SaleReturn = require("../models/SaleReturn");
const PurchaseReturn = require("../models/PurchaseReturn");
const SaleLedger = require("../models/SaleLedger");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitiveFinancials = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const canViewOperationalAmounts = (req) =>
  ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${req.user?.role || ""}`);

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const getSaleCollectibleDue = (sale = {}) =>
  Math.max(
    0,
    roundAmount(
      Number(sale?.totalAmount || 0) -
        Number(sale?.returnedAmount || 0) -
        Number(sale?.paidAmount || 0) -
        Number(sale?.walletUsedAmount || 0),
    ),
  );

const saleCollectibleDueExpr = () => ({
  $max: [
    0,
    {
      $subtract: [
        {
          $subtract: [
            {
              $subtract: [
                { $ifNull: ["$totalAmount", 0] },
                { $ifNull: ["$returnedAmount", 0] },
              ],
            },
            { $ifNull: ["$paidAmount", 0] },
          ],
        },
        { $ifNull: ["$walletUsedAmount", 0] },
      ],
    },
  ],
});

const normalizeDashboardRange = (raw) => {
  const range = `${raw || "daily"}`.trim().toLowerCase();
  return ["daily", "weekly", "monthly", "yearly", "all"].includes(range) ? range : "daily";
};

const getRangeStartDate = (range, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "daily") {
    return start;
  }

  if (range === "weekly") {
    start.setDate(start.getDate() - 6);
    return start;
  }

  if (range === "monthly") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (range === "yearly") {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
};

const getTrendDaysForRange = (range) => {
  if (range === "daily") return 1;
  if (range === "weekly") return 7;
  if (range === "monthly") return 30;
  if (range === "yearly") return 365;
  return 730;
};

const getPaymentModeGroup = (method) => {
  const normalized = `${method || ""}`.trim().toUpperCase();
  if (normalized === "CASH") return "CASH";
  if (["UPI", "CARD", "BANK", "ONLINE", "BANK_TRANSFER"].includes(normalized)) {
    return "ONLINE";
  }
  return "OTHER";
};

const buildRangeMatch = (range, fieldName = "createdAt", now = new Date()) => {
  const start = getRangeStartDate(range, now);
  if (!start) {
    return {};
  }

  return {
    [fieldName]: { $gte: start, $lte: now },
  };
};

exports.getOverview = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const allowFinancials = canViewSensitiveFinancials(req);
    const allowOperationalAmounts = canViewOperationalAmounts(req);
    const range = normalizeDashboardRange(req.query?.range);
    const now = new Date();
    const rangeStart = getRangeStartDate(range, now);
    const createdAtMatch = rangeStart ? { createdAt: { $gte: rangeStart, $lte: now } } : {};
    const salePaidAtMatch = rangeStart ? { createdAt: { $gte: rangeStart, $lte: now } } : {};
    const orderPaidAtMatch = rangeStart
      ? {
          $or: [
            { paymentCollectedAt: { $gte: rangeStart, $lte: now } },
            {
              paymentCollectedAt: { $exists: false },
              createdAt: { $gte: rangeStart, $lte: now },
            },
          ],
        }
      : {};

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
      Order.find({ ...query, ...createdAtMatch })
        .select("orderNo totalAmount dueAmount orderStatus orderSource createdAt paymentStatus customer")
        .populate("customer", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Sale.find({ ...query, ...createdAtMatch })
        .select("invoiceNo customerName totalAmount paidAmount walletUsedAmount returnedAmount paymentMethod status createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Sale.aggregate([
        { $match: { ...query, ...createdAtMatch, status: { $ne: "CANCELLED" } } },
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
      Sale.find({ ...query, ...salePaidAtMatch, paidAmount: { $gt: 0 }, status: { $ne: "CANCELLED" } })
        .select("invoiceNo customerName paidAmount paymentMethod createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Order.find({ ...query, ...orderPaidAtMatch, paidAmount: { $gt: 0 } })
        .select("orderNo paidAmount paymentMethod paymentCollectedAt createdAt customer")
        .populate("customer", "name")
        .sort({ paymentCollectedAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      allowFinancials
        ? Sale.aggregate([
            { $match: { ...query, status: { $ne: "CANCELLED" } } },
            { $addFields: { collectibleDue: saleCollectibleDueExpr() } },
            { $match: { collectibleDue: { $gt: 0 } } },
            {
              $group: {
                _id: null,
                totalDue: { $sum: "$collectibleDue" },
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
          dueAmount: allowOperationalAmounts ? getSaleCollectibleDue(sale) : 0,
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
        range,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard overview",
      error: "Internal server error",
    });
  }
};

exports.getKpis = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const allowFinancials = canViewSensitiveFinancials(req);
    const range = normalizeDashboardRange(req.query?.range);

    const now = new Date();
    const start = getRangeStartDate(range, now) || new Date(0);
    const end = now;

    const [salesAgg, todayOrders, activeShops, totalCustomers, lowStockCount, distributorDueAgg, todayPurchaseAgg, todaySaleReturnAgg, todayPurchaseReturnAgg] =
      await Promise.all([
        Sale.aggregate([
          { $match: { ...query, createdAt: { $gte: start, $lte: end } } },
          { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" }, salesCount: { $sum: 1 } } },
        ]),
        Order.countDocuments({ ...query, createdAt: { $gte: start, $lte: end } }),
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
              confirmedAt: { $gte: start, $lte: end },
            },
          },
          { $group: { _id: null, totalPurchase: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
        ]),
        SaleReturn.aggregate([
          { $match: { ...query, createdAt: { $gte: start, $lte: end } } },
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
          { $match: { ...query, createdAt: { $gte: start, $lte: end }, status: "APPROVED" } },
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
        range,
        mode: isSuperAdminGlobal(req) ? "GLOBAL" : "SHOP_WISE",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard KPIs",
      error: "Internal server error",
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

    const buildOrderReturnMatch = (start) => ({
      ...query,
      orderStatus: "RETURNED",
      updatedAt: { $gte: start, $lte: now },
    });

    const saleReturnAggPipeline = (start) => [
      { $match: buildMatch(start) },
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
    ];

    const orderReturnAggPipeline = (start) => [
      { $match: buildOrderReturnMatch(start) },
      {
        $group: {
          _id: null,
          amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
          refund: { $sum: { $ifNull: ["$refundedAmount", 0] } },
          qty: { $sum: { $ifNull: ["$totalQuantity", 0] } },
          count: { $sum: 1 },
        },
      },
    ];

    const [todaySaleAgg, weekSaleAgg, monthSaleAgg, todayOrderAgg, weekOrderAgg, monthOrderAgg] = await Promise.all([
      SaleReturn.aggregate(saleReturnAggPipeline(startOfDay)),
      SaleReturn.aggregate(saleReturnAggPipeline(startOfWeek)),
      SaleReturn.aggregate(saleReturnAggPipeline(startOfMonth)),
      Order.aggregate(orderReturnAggPipeline(startOfDay)),
      Order.aggregate(orderReturnAggPipeline(startOfWeek)),
      Order.aggregate(orderReturnAggPipeline(startOfMonth)),
    ]);

    const normalize = (saleRow, orderRow) => ({
      totalAmount: Number(saleRow?.amount || 0) + Number(orderRow?.amount || 0),
      totalRefund: Number(saleRow?.refund || 0) + Number(orderRow?.refund || 0),
      totalCredit: Number(saleRow?.credit || 0),
      totalQty: Number(saleRow?.qty || 0) + Number(orderRow?.qty || 0),
      count: Number(saleRow?.count || 0) + Number(orderRow?.count || 0),
      saleReturnAmount: Number(saleRow?.amount || 0),
      saleReturnRefund: Number(saleRow?.refund || 0),
      saleReturnCredit: Number(saleRow?.credit || 0),
      saleReturnQty: Number(saleRow?.qty || 0),
      saleReturnCount: Number(saleRow?.count || 0),
      orderReturnAmount: Number(orderRow?.amount || 0),
      orderReturnRefund: Number(orderRow?.refund || 0),
      orderReturnQty: Number(orderRow?.qty || 0),
      orderReturnCount: Number(orderRow?.count || 0),
    });

    return res.status(200).json({
      success: true,
      data: {
        today: normalize(todaySaleAgg[0], todayOrderAgg[0]),
        weekly: normalize(weekSaleAgg[0], weekOrderAgg[0]),
        monthly: normalize(monthSaleAgg[0], monthOrderAgg[0]),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load return analytics",
      error: "Internal server error",
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
      error: "Internal server error",
    });
  }
};

exports.getPaymentCollectionAnalytics = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const range = normalizeDashboardRange(req.query?.range);
    const now = new Date();
    const rangeStart = getRangeStartDate(range, now);
    const orderPaymentFilterCondition = range === "all"
      ? { $literal: true }
      : {
          $and: [
            { $gte: ["$$payment.collectedAt", rangeStart] },
            { $lte: ["$$payment.collectedAt", now] },
          ],
        };

    const salePaymentMatch = {
      ...query,
      type: "payment",
      ...buildRangeMatch(range, "createdAt", now),
    };

    const orderBaseMatch = { ...query };

    const [saleGroupRows, saleSummaryRows, orderGroupRows, orderSummaryRows, walletUseRows] = await Promise.all([
      SaleLedger.aggregate([
        { $match: salePaymentMatch },
        {
          $project: {
            sale: 1,
            amount: { $ifNull: ["$amount", 0] },
            paymentGroup: {
              $switch: {
                branches: [
                  { case: { $eq: ["$paymentMethod", "CASH"] }, then: "CASH" },
                  { case: { $in: ["$paymentMethod", ["UPI", "CARD", "BANK", "ONLINE", "BANK_TRANSFER"]] }, then: "ONLINE" },
                ],
                default: "OTHER",
              },
            },
          },
        },
        {
          $group: {
            _id: "$paymentGroup",
            totalAmount: { $sum: "$amount" },
            entryCount: { $sum: 1 },
          },
        },
      ]),
      SaleLedger.aggregate([
        { $match: salePaymentMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            entryCount: { $sum: 1 },
            saleIds: { $addToSet: "$sale" },
          },
        },
        {
          $project: {
            _id: 0,
            totalAmount: 1,
            entryCount: 1,
            billCount: { $size: "$saleIds" },
          },
        },
      ]),
      Order.aggregate([
        { $match: orderBaseMatch },
        {
          $project: {
            paymentHistory: {
              $filter: {
                input: { $ifNull: ["$paymentHistory", []] },
                as: "payment",
                cond: orderPaymentFilterCondition,
              },
            },
          },
        },
        { $unwind: "$paymentHistory" },
        {
          $project: {
            amount: { $ifNull: ["$paymentHistory.amount", 0] },
            paymentGroup: {
              $switch: {
                branches: [
                  { case: { $eq: ["$paymentHistory.paymentMethod", "CASH"] }, then: "CASH" },
                  { case: { $in: ["$paymentHistory.paymentMethod", ["UPI", "CARD", "ONLINE", "BANK_TRANSFER"]] }, then: "ONLINE" },
                ],
                default: "OTHER",
              },
            },
          },
        },
        {
          $group: {
            _id: "$paymentGroup",
            totalAmount: { $sum: "$amount" },
            entryCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: orderBaseMatch },
        {
          $project: {
            orderId: "$_id",
            paymentHistory: {
              $filter: {
                input: { $ifNull: ["$paymentHistory", []] },
                as: "payment",
                cond: orderPaymentFilterCondition,
              },
            },
          },
        },
        { $unwind: "$paymentHistory" },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$paymentHistory.amount", 0] } },
            entryCount: { $sum: 1 },
            orderIds: { $addToSet: "$orderId" },
          },
        },
        {
          $project: {
            _id: 0,
            totalAmount: 1,
            entryCount: 1,
            billCount: { $size: "$orderIds" },
          },
        },
      ]),
      SaleLedger.aggregate([
        {
          $match: {
            ...query,
            type: "wallet_use",
            ...buildRangeMatch(range, "createdAt", now),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $ifNull: ["$amount", 0] } },
            entryCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const toModeMap = (rows = []) =>
      rows.reduce(
        (acc, row) => {
          const key = `${row?._id || ""}`.toUpperCase();
          if (key === "CASH" || key === "ONLINE") {
            acc[key] = {
              totalAmount: Number(row?.totalAmount || 0),
              entryCount: Number(row?.entryCount || 0),
            };
          }
          return acc;
        },
        {
          CASH: { totalAmount: 0, entryCount: 0 },
          ONLINE: { totalAmount: 0, entryCount: 0 },
        },
      );

    const saleModeMap = toModeMap(saleGroupRows);
    const orderModeMap = toModeMap(orderGroupRows);
    const saleSummary = saleSummaryRows[0] || {};
    const orderSummary = orderSummaryRows[0] || {};
    const walletSummary = walletUseRows[0] || {};

    const cashCollected = Number(saleModeMap.CASH.totalAmount || 0) + Number(orderModeMap.CASH.totalAmount || 0);
    const onlineCollected =
      Number(saleModeMap.ONLINE.totalAmount || 0) + Number(orderModeMap.ONLINE.totalAmount || 0);

    return res.status(200).json({
      success: true,
      data: {
        range,
        totalCollected: roundAmount(cashCollected + onlineCollected),
        cashCollected: roundAmount(cashCollected),
        onlineCollected: roundAmount(onlineCollected),
        walletUsed: roundAmount(walletSummary.totalAmount || 0),
        cashEntryCount: Number(saleModeMap.CASH.entryCount || 0) + Number(orderModeMap.CASH.entryCount || 0),
        onlineEntryCount:
          Number(saleModeMap.ONLINE.entryCount || 0) + Number(orderModeMap.ONLINE.entryCount || 0),
        saleCollected: roundAmount(saleSummary.totalAmount || 0),
        saleEntryCount: Number(saleSummary.entryCount || 0),
        saleBillCount: Number(saleSummary.billCount || 0),
        orderCollected: roundAmount(orderSummary.totalAmount || 0),
        orderEntryCount: Number(orderSummary.entryCount || 0),
        orderBillCount: Number(orderSummary.billCount || 0),
        walletUseCount: Number(walletSummary.entryCount || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load payment collection analytics",
      error: "Internal server error",
    });
  }
};

exports.getTrends = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const range = normalizeDashboardRange(req.query?.range);
    const requestedDays = Number(req.query.days || 0);
    const days = requestedDays > 0
      ? Math.min(730, Math.max(1, requestedDays))
      : getTrendDaysForRange(range);
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
        range,
        days,
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
      error: "Internal server error",
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
      error: "Internal server error",
    });
  }
};
