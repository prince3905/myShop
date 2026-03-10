const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Sale = require("../models/CustomerSale");
const SaleLedger = require("../models/SaleLedger");
const SaleReturn = require("../models/SaleReturn");
const Order = require("../models/Order");
const OrderLedger = require("../models/OrderLedger");

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const normalizeCustomerPhone = (value) => Customer.normalizePhone(value);
const normalizeCustomerEmail = (value) => Customer.normalizeEmail(value);

const buildDuplicateError = ({ phone, email }) => {
  if (phone) {
    return "Customer phone already exists in this shop";
  }
  if (email) {
    return "Customer email already exists in this shop";
  }
  return "Customer already exists in this shop";
};

const ensureUniqueCustomerIdentity = async ({
  shopId,
  phone,
  email,
  excludeCustomerId = null,
}) => {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedEmail = normalizeCustomerEmail(email);
  const checks = [];

  if (normalizedPhone) {
    checks.push({
      field: "phone",
      query: {
        shop: shopId,
        phone: normalizedPhone,
        ...(excludeCustomerId ? { _id: { $ne: excludeCustomerId } } : {}),
      },
    });
  }

  if (normalizedEmail) {
    checks.push({
      field: "email",
      query: {
        shop: shopId,
        email: normalizedEmail,
        ...(excludeCustomerId ? { _id: { $ne: excludeCustomerId } } : {}),
      },
    });
  }

  for (const check of checks) {
    const existing = await Customer.findOne(check.query).select("_id").lean();
    if (existing) {
      const error = new Error(buildDuplicateError({ [check.field]: true }));
      error.statusCode = 409;
      throw error;
    }
  }

  return {
    phone: normalizedPhone,
    email: normalizedEmail,
  };
};

const buildCustomerPayload = async ({
  shopId,
  body = {},
  excludeCustomerId = null,
  requirePhone = false,
}) => {
  const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
  const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
  const normalized = await ensureUniqueCustomerIdentity({
    shopId,
    phone: hasPhone ? body.phone : undefined,
    email: hasEmail ? body.email : undefined,
    excludeCustomerId,
  });

  if (requirePhone && !normalized.phone) {
    const error = new Error("Customer phone is required");
    error.statusCode = 400;
    throw error;
  }

  const payload = { ...body };

  if (hasPhone || requirePhone) {
    payload.phone = normalized.phone;
  }

  if (hasEmail) {
    payload.email = normalized.email || undefined;
  }

  if (!payload.email) {
    delete payload.email;
  }

  return payload;
};

const syncCustomerAccountSnapshot = async ({ shopId, customerId }) => {
  if (!shopId || !customerId || !mongoose.Types.ObjectId.isValid(`${customerId}`)) {
    return null;
  }

  const customerObjectId =
    customerId instanceof mongoose.Types.ObjectId
      ? customerId
      : new mongoose.Types.ObjectId(customerId);

  const [salesSummary, returnsSummary, orderLedgerSummary] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          shop: shopId,
          customer: customerObjectId,
        },
      },
      {
        $group: {
          _id: null,
          totalPurchase: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$paidAmount" },
          totalWalletUsed: { $sum: "$walletUsedAmount" },
          purchaseCount: { $sum: 1 },
        },
      },
    ]),
    SaleReturn.aggregate([
      {
        $lookup: {
          from: Sale.collection.name,
          localField: "sale",
          foreignField: "_id",
          as: "saleDoc",
        },
      },
      { $unwind: "$saleDoc" },
      {
        $match: {
          shop: shopId,
          status: "APPROVED",
          "saleDoc.customer": customerObjectId,
        },
      },
      {
        $group: {
          _id: null,
          returnedAmount: { $sum: "$totalAmount" },
          refundedAmount: { $sum: "$refundAmount" },
          creditedAmount: { $sum: "$creditAmount" },
        },
      },
    ]),
    OrderLedger.aggregate([
      {
        $match: {
          shop: shopId,
          customer: customerObjectId,
        },
      },
      {
        $group: {
          _id: null,
          orderDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "order"] }, "$amount", 0],
            },
          },
          orderPayment: {
            $sum: {
              $cond: [{ $eq: ["$type", "payment"] }, "$amount", 0],
            },
          },
          orderCancelReturn: {
            $sum: {
              $cond: [{ $in: ["$type", ["cancellation", "return"]] }, "$amount", 0],
            },
          },
          orderRefund: {
            $sum: {
              $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0],
            },
          },
          orderCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "order"] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const saleTotals = salesSummary[0] || {};
  const returnTotals = returnsSummary[0] || {};
  const orderTotals = orderLedgerSummary[0] || {};
  const totalPurchase = Math.max(
    0,
    roundAmount(
      Number(saleTotals.totalPurchase || 0) -
        Number(returnTotals.returnedAmount || 0) +
        Number(orderTotals.orderDebit || 0) -
        Number(orderTotals.orderCancelReturn || 0),
    ),
  );
  const totalPaid = Math.max(
    0,
    roundAmount(
      Number(saleTotals.totalPaid || 0) -
        Number(returnTotals.refundedAmount || 0) +
        Number(saleTotals.totalWalletUsed || 0) +
        Number(orderTotals.orderPayment || 0) -
        Number(orderTotals.orderRefund || 0),
    ),
  );
  const totalWalletUsed = Math.max(0, roundAmount(Number(saleTotals.totalWalletUsed || 0)));
  const totalDue = Math.max(0, roundAmount(totalPurchase - totalPaid - totalWalletUsed));
  const walletBalance = Math.max(
    0,
    roundAmount(Number(returnTotals.creditedAmount || 0) - totalWalletUsed),
  );
  const purchaseCount = Number(saleTotals.purchaseCount || 0) + Number(orderTotals.orderCount || 0);

  await Customer.findOneAndUpdate(
    { _id: customerObjectId, shop: shopId },
    {
      totalPurchase,
      totalPaid,
      totalDue,
      walletBalance,
      purchaseCount,
    },
    { new: false },
  );

  return {
    totalPurchase,
    totalPaid,
    totalDue,
    walletBalance,
    purchaseCount,
  };
};

const sortByTimeline = (a, b) => {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  if (aTime !== bTime) return aTime - bTime;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return `${a._id || ""}`.localeCompare(`${b._id || ""}`);
};

const buildCustomerLedger = async ({
  shopId,
  customerId,
  dateFrom,
  dateTo,
  page = 1,
  perPage = 10,
}) => {
  const sales = await Sale.find({ shop: shopId, customer: customerId })
    .sort({ createdAt: 1, _id: 1 })
      .select(
      "_id invoiceNo items totalAmount paidAmount walletUsedAmount dueAmount paymentMethod returnedAmount refundedAmount creditedAmount createdAt",
    )
    .lean();

  const saleIds = sales.map((sale) => sale._id);
  const saleMap = new Map(sales.map((sale) => [`${sale._id}`, sale]));

  const [payments, walletUses, saleReturns, orderLedgerEntries] = await Promise.all([
    saleIds.length
      ? SaleLedger.find({
          shop: shopId,
          customer: customerId,
          type: "payment",
          sale: { $in: saleIds },
        })
          .sort({ createdAt: 1, _id: 1 })
          .select("_id sale amount paymentMethod note createdAt")
          .lean()
      : [],
    saleIds.length
      ? SaleLedger.find({
          shop: shopId,
          customer: customerId,
          type: "wallet_use",
          sale: { $in: saleIds },
        })
          .sort({ createdAt: 1, _id: 1 })
          .select("_id sale amount paymentMethod note createdAt")
          .lean()
      : [],
    saleIds.length
      ? SaleReturn.find({
          shop: shopId,
          sale: { $in: saleIds },
          status: "APPROVED",
        })
          .sort({ createdAt: 1, _id: 1 })
          .select(
            "_id sale items totalAmount refundAmount dueAdjustedAmount creditAmount refundMethod note createdAt",
          )
          .lean()
      : [],
    OrderLedger.find({
      shop: shopId,
      customer: customerId,
    })
      .sort({ createdAt: 1, _id: 1 })
      .select("_id order type amount paymentMethod note createdAt")
      .lean(),
  ]);

  const orderIds = [...new Set(orderLedgerEntries.map((entry) => `${entry.order || ""}`).filter(Boolean))];
  const orderRows = orderIds.length
    ? await Order.find({ _id: { $in: orderIds } })
        .select("_id orderNo items createdAt")
        .lean()
    : [];
  const orderMap = new Map(orderRows.map((order) => [`${order._id}`, order]));

  const ledgerRows = [];

  for (const sale of sales) {
    ledgerRows.push({
      _id: `sale:${sale._id}`,
      transactionId: sale._id,
      transactionType: "sale",
      label: "Sale",
      saleId: sale._id,
      invoiceNo: sale.invoiceNo || `${sale._id}`,
      paymentMethod: sale.paymentMethod || null,
      note: "",
      items: sale.items || [],
      debit: roundAmount(sale.totalAmount),
      credit: 0,
      createdAt: sale.createdAt,
      sortOrder: 10,
    });
  }

  for (const payment of payments) {
    const sale = saleMap.get(`${payment.sale}`);
    ledgerRows.push({
      _id: `payment:${payment._id}`,
      transactionId: payment._id,
      transactionType: "payment",
      label: "Payment",
      saleId: payment.sale,
      invoiceNo: sale?.invoiceNo || `${payment.sale}`,
      paymentMethod: payment.paymentMethod || null,
      note: payment.note || "",
      items: [],
      debit: 0,
      credit: roundAmount(payment.amount),
      createdAt: payment.createdAt,
      sortOrder: 20,
    });
  }

  for (const walletUse of walletUses) {
    const sale = saleMap.get(`${walletUse.sale}`);
    ledgerRows.push({
      _id: `wallet:${walletUse._id}`,
      transactionId: walletUse._id,
      transactionType: "payment",
      label: "Wallet Used",
      saleId: walletUse.sale,
      invoiceNo: sale?.invoiceNo || `${walletUse.sale}`,
      paymentMethod: walletUse.paymentMethod || "STORE_CREDIT",
      note: walletUse.note || "",
      items: [],
      debit: 0,
      credit: roundAmount(walletUse.amount),
      createdAt: walletUse.createdAt,
      sortOrder: 22,
    });
  }

  for (const saleReturn of saleReturns) {
    const sale = saleMap.get(`${saleReturn.sale}`);
    const returnNotes = [];
    if (Number(saleReturn.dueAdjustedAmount || 0) > 0) {
      returnNotes.push(`due adjusted Rs ${roundAmount(saleReturn.dueAdjustedAmount)}`);
    }
    if (Number(saleReturn.refundAmount || 0) > 0) {
      returnNotes.push(`refund Rs ${roundAmount(saleReturn.refundAmount)}`);
    }
    if (Number(saleReturn.creditAmount || 0) > 0) {
      returnNotes.push(`store credit Rs ${roundAmount(saleReturn.creditAmount)}`);
    }

    ledgerRows.push({
      _id: `return:${saleReturn._id}`,
      transactionId: saleReturn._id,
      transactionType: "return",
      label: "Sale Return",
      saleId: saleReturn.sale,
      invoiceNo: sale?.invoiceNo || `${saleReturn.sale}`,
      paymentMethod: saleReturn.refundMethod || null,
      note: [saleReturn.note, returnNotes.join(", ")].filter(Boolean).join(" | "),
      items: saleReturn.items || [],
      debit: 0,
      credit: roundAmount(saleReturn.totalAmount),
      refundAmount: roundAmount(saleReturn.refundAmount || 0),
      creditAmount: roundAmount(saleReturn.creditAmount || 0),
      dueAdjustedAmount: roundAmount(saleReturn.dueAdjustedAmount || 0),
      createdAt: saleReturn.createdAt,
      sortOrder: 30,
    });

    if (Number(saleReturn.refundAmount || 0) > 0) {
      ledgerRows.push({
        _id: `refund:${saleReturn._id}`,
        transactionId: saleReturn._id,
        transactionType: "refund",
        label: "Refund",
        saleId: saleReturn.sale,
        invoiceNo: sale?.invoiceNo || `${saleReturn.sale}`,
        paymentMethod: saleReturn.refundMethod || null,
        note: saleReturn.note || "Return refund settled",
        items: [],
        debit: 0,
        credit: 0,
        refundAmount: roundAmount(saleReturn.refundAmount || 0),
        creditAmount: 0,
        dueAdjustedAmount: 0,
        createdAt: saleReturn.createdAt,
        sortOrder: 40,
      });
    }
  }

  for (const entry of orderLedgerEntries) {
    const order = orderMap.get(`${entry.order}`);
    const type = `${entry.type || ""}`;
    const configMap = {
      order: { transactionType: "order", label: "Order", debit: roundAmount(entry.amount), credit: 0, sortOrder: 15 },
      payment: { transactionType: "payment", label: "Order Payment", debit: 0, credit: roundAmount(entry.amount), sortOrder: 25 },
      cancellation: { transactionType: "return", label: "Order Cancelled", debit: 0, credit: roundAmount(entry.amount), sortOrder: 35 },
      return: { transactionType: "return", label: "Order Return", debit: 0, credit: roundAmount(entry.amount), sortOrder: 35 },
      refund: { transactionType: "refund", label: "Order Refund", debit: 0, credit: 0, sortOrder: 45 },
    };
    const config = configMap[type];
    if (!config) continue;

    ledgerRows.push({
      _id: `order-ledger:${entry._id}`,
      transactionId: entry._id,
      transactionType: config.transactionType,
      label: config.label,
      saleId: null,
      orderId: entry.order,
      invoiceNo: order?.orderNo || `${entry.order}`,
      paymentMethod: entry.paymentMethod || null,
      note: entry.note || "",
      items: order?.items || [],
      debit: config.debit,
      credit: config.credit,
      createdAt: entry.createdAt,
      sortOrder: config.sortOrder,
    });
  }

  ledgerRows.sort(sortByTimeline);

  let runningBalance = 0;
  const withBalance = ledgerRows.map((row) => {
    runningBalance = Math.max(
      0,
      roundAmount(runningBalance + Number(row.debit || 0) - Number(row.credit || 0)),
    );
    return {
      ...row,
      runningBalance,
    };
  });

  const filterFrom = dateFrom ? new Date(dateFrom) : null;
  if (filterFrom && !Number.isNaN(filterFrom.getTime())) {
    filterFrom.setHours(0, 0, 0, 0);
  }

  const filterTo = dateTo ? new Date(dateTo) : null;
  if (filterTo && !Number.isNaN(filterTo.getTime())) {
    filterTo.setHours(23, 59, 59, 999);
  }

  const filteredRows = withBalance.filter((row) => {
    const createdAt = new Date(row.createdAt);
    if (filterFrom && createdAt < filterFrom) return false;
    if (filterTo && createdAt > filterTo) return false;
    return true;
  });

  const orderedRows = [...filteredRows].sort((a, b) => sortByTimeline(b, a));
  const safePerPage = Math.max(1, Number(perPage || 10));
  const safePage = Math.max(1, Number(page || 1));
  const startIndex = (safePage - 1) * safePerPage;
  const paginatedRows = orderedRows.slice(startIndex, startIndex + safePerPage);

  return {
    rows: paginatedRows,
    totalItems: orderedRows.length,
    summary: {
      totalDebit: roundAmount(filteredRows.reduce((sum, row) => sum + Number(row.debit || 0), 0)),
      totalCredit: roundAmount(filteredRows.reduce((sum, row) => sum + Number(row.credit || 0), 0)),
      totalRefunded: roundAmount(filteredRows.reduce((sum, row) => sum + Number(row.refundAmount || 0), 0)),
      totalCredited: roundAmount(filteredRows.reduce((sum, row) => sum + Number(row.creditAmount || 0), 0)),
      totalDueAdjusted: roundAmount(filteredRows.reduce((sum, row) => sum + Number(row.dueAdjustedAmount || 0), 0)),
      closingBalance: filteredRows.length
        ? roundAmount(filteredRows[filteredRows.length - 1].runningBalance)
        : 0,
    },
  };
};

const getCustomerDuplicateMessage = (error) => {
  if (!error) return "Customer already exists in this shop";
  if (error.statusCode === 409) return error.message;
  if (error?.code !== 11000) return null;

  const duplicateFields = {
    ...(error.keyPattern || {}),
    ...(error.keyValue || {}),
  };
  return buildDuplicateError({
    phone: Boolean(duplicateFields.phone),
    email: Boolean(duplicateFields.email),
  });
};

module.exports = {
  normalizeCustomerPhone,
  normalizeCustomerEmail,
  ensureUniqueCustomerIdentity,
  buildCustomerPayload,
  syncCustomerAccountSnapshot,
  buildCustomerLedger,
  getCustomerDuplicateMessage,
};
