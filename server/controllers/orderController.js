const mongoose = require("mongoose");
const Order = require("../models/order");
const Customer = require("../models/Customer");
const ProductVariation = require("../models/ProductVariation");
const { generateInvoiceNo } = require("../utils/invoice.service");
const { applyStockTransaction } = require("../utils/stock.service");
const { syncOrderLedger } = require("../utils/orderLedger.service");
const { syncCustomerAccountSnapshot } = require("../utils/customerAccount.service");

const ORDER_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
]);
const PAYMENT_STATUSES = new Set(["PENDING", "PAID", "FAILED", "REFUNDED"]);
const PAYMENT_METHODS = new Set(["CASH", "UPI", "CARD", "ONLINE", "BANK_TRANSFER"]);
const ORDER_SOURCES = new Set(["POS", "ONLINE"]);

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitivePricing = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);
const getDayBounds = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const sanitizeOrderPricing = (order, req) => {
  if (!order || canViewSensitivePricing(req)) {
    return order;
  }

  const plainOrder = order.toObject?.() || { ...order };
  plainOrder.items = Array.isArray(plainOrder.items)
    ? plainOrder.items.map((item) => {
        const safeItem = { ...item };
        delete safeItem.purchasePrice;
        return safeItem;
      })
    : [];
  return plainOrder;
};

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));
const buildPaymentHistoryEntry = ({
  amount = 0,
  paymentMethod = "CASH",
  note = "",
  collectedAt = new Date(),
} = {}) => ({
  amount: roundAmount(amount),
  paymentMethod,
  note: `${note || ""}`.trim(),
  collectedAt,
});

const buildAdvancePaymentHistory = ({ draft, existingOrder = null }) => {
  const paidAmount = roundAmount(draft?.paidAmount || 0);
  if (paidAmount <= 0) {
    return [];
  }

  const defaultNote = existingOrder
    ? `Advance updated for ${existingOrder.orderNo || "order"}`
    : "Advance received with order";

  return [
    buildPaymentHistoryEntry({
      amount: paidAmount,
      paymentMethod: draft?.paymentMethod || "CASH",
      note: existingOrder?.paymentNote || defaultNote,
      collectedAt: existingOrder?.paymentCollectedAt || new Date(),
    }),
  ];
};

const STOCK_APPLY_STATUSES = new Set(["CONFIRMED", "DELIVERED"]);
const STOCK_REVERSE_STATUSES = new Set(["CANCELLED", "RETURNED"]);
const ORDER_STATUS_TRANSITIONS = {
  PENDING: new Set(["CONFIRMED", "CANCELLED"]),
  CONFIRMED: new Set(["SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]),
  SHIPPED: new Set(["DELIVERED", "RETURNED", "CANCELLED"]),
  DELIVERED: new Set(["RETURNED"]),
  CANCELLED: new Set([]),
  RETURNED: new Set([]),
};
const FULLY_EDITABLE_ORDER_STATUSES = new Set(["PENDING"]);

const resolveVariation = async (shopId, rawItem = {}) => {
  const variationId = `${rawItem?.variationId || ""}`.trim();
  const sku = `${rawItem?.sku || rawItem?.variationSku || ""}`.trim();

  let query = null;
  if (variationId && mongoose.Types.ObjectId.isValid(variationId)) {
    query = { _id: variationId, shop: shopId };
  } else if (sku) {
    query = { sku, shop: shopId };
  }

  if (!query) {
    return null;
  }

  return ProductVariation.findOne(query)
    .populate("product", "name")
    .populate("model", "name");
};

const buildOrderDraftFromRequest = async (req) => {
  if (!req.body?.customerId) {
    const error = new Error("Customer is required for orders");
    error.statusCode = 400;
    throw error;
  }

  const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!payloadItems.length) {
    const error = new Error("items[] is required");
    error.statusCode = 400;
    throw error;
  }

  let customer = null;
  if (req.body?.customerId) {
    if (!mongoose.Types.ObjectId.isValid(`${req.body.customerId}`)) {
      const error = new Error("Invalid customer id");
      error.statusCode = 400;
      throw error;
    }

    customer = await Customer.findOne({
      _id: req.body.customerId,
      shop: req.shopId,
      isDeleted: { $ne: true },
    }).select("_id");

    if (!customer) {
      const error = new Error("Customer not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const items = [];
  let subTotal = 0;
  let itemLevelDiscount = 0;
  let totalQuantity = 0;

  for (const rawItem of payloadItems) {
    const variation = await resolveVariation(req.shopId, rawItem);
    if (!variation) {
      const error = new Error(
        `Variation not found for item ${rawItem?.sku || rawItem?.variationSku || rawItem?.variationId || "unknown"}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const quantity = Math.max(0, Number(rawItem?.quantity || 0));
    if (quantity <= 0) {
      const error = new Error("Item quantity must be greater than 0");
      error.statusCode = 400;
      throw error;
    }

    const sellingPrice = Math.max(0, Number(rawItem?.sellingPrice ?? variation.sellingPrice ?? 0));
    const grossLineTotal = roundAmount(quantity * sellingPrice);
    const discountAmount = Math.max(0, roundAmount(rawItem?.discountAmount || 0));

    if (discountAmount > grossLineTotal) {
      const error = new Error(`Discount cannot exceed line total for SKU ${variation.sku}`);
      error.statusCode = 400;
      throw error;
    }

    const lineTotal = roundAmount(grossLineTotal - discountAmount);
    subTotal = roundAmount(subTotal + grossLineTotal);
    itemLevelDiscount = roundAmount(itemLevelDiscount + discountAmount);
    totalQuantity += quantity;

    items.push({
      item: variation.product?._id || variation.product,
      productName: variation.product?.name || "",
      modelId: variation.model?._id || variation.model,
      variationId: variation._id,
      sku: variation.sku,
      modelName: variation.model?.name || "",
      variation: {
        color: variation.attributes?.color || "",
        size: variation.attributes?.size || "",
      },
      purchasePrice: roundAmount(variation.costPrice || 0),
      sellingPrice,
      discountAmount,
      quantity,
      totalPrice: lineTotal,
    });
  }

  const additionalDiscount = Math.max(0, roundAmount(req.body?.additionalDiscount || 0));
  const discountBeforeTax = roundAmount(itemLevelDiscount + additionalDiscount);
  if (discountBeforeTax > subTotal) {
    const error = new Error("Total discount cannot exceed subtotal");
    error.statusCode = 400;
    throw error;
  }

  const taxAmount = Math.max(0, roundAmount(req.body?.taxAmount || 0));
  const orderSource = `${req.body?.orderSource || "ONLINE"}`.trim().toUpperCase();
  const orderStatus = `${req.body?.orderStatus || "PENDING"}`.trim().toUpperCase();
  const paymentStatus = `${req.body?.paymentStatus || "PENDING"}`.trim().toUpperCase();
  const paymentMethod = req.body?.paymentMethod
    ? `${req.body.paymentMethod}`.trim().toUpperCase()
    : undefined;
  const deliveryContactName = `${req.body?.deliveryContactName || ""}`.trim();
  const deliveryPhone = `${req.body?.deliveryPhone || ""}`.trim();
  const deliveryAddress = `${req.body?.deliveryAddress || ""}`.trim();
  const deliveryNote = `${req.body?.deliveryNote || ""}`.trim();
  const expectedDeliveryDate = req.body?.expectedDeliveryDate
    ? new Date(req.body.expectedDeliveryDate)
    : null;

  if (!ORDER_SOURCES.has(orderSource)) {
    const error = new Error("Invalid order source");
    error.statusCode = 400;
    throw error;
  }
  if (!ORDER_STATUSES.has(orderStatus)) {
    const error = new Error("Invalid order status");
    error.statusCode = 400;
    throw error;
  }
  if (!PAYMENT_STATUSES.has(paymentStatus)) {
    const error = new Error("Invalid payment status");
    error.statusCode = 400;
    throw error;
  }
  if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
    const error = new Error("Invalid payment method");
    error.statusCode = 400;
    throw error;
  }
  if (expectedDeliveryDate && Number.isNaN(expectedDeliveryDate.getTime())) {
    const error = new Error("Invalid expected delivery date");
    error.statusCode = 400;
    throw error;
  }

  const totalAmount = roundAmount(subTotal - discountBeforeTax + taxAmount);
  const requestedPaidAmount = Math.max(0, roundAmount(req.body?.paidAmount || 0));
  if (requestedPaidAmount > totalAmount) {
    const error = new Error("Paid amount cannot exceed total amount");
    error.statusCode = 400;
    throw error;
  }
  const paidAmount = paymentStatus === "PAID" ? totalAmount : requestedPaidAmount;
  const dueAmount = roundAmount(Math.max(0, totalAmount - paidAmount));
  const resolvedPaymentStatus = dueAmount <= 0 && totalAmount > 0 ? "PAID" : paymentStatus;

  return {
    customerId: customer?._id || undefined,
    items,
    totalQuantity,
    subTotal,
    totalDiscount: discountBeforeTax,
    taxAmount,
    totalAmount,
    paidAmount,
    dueAmount,
    orderSource,
    orderStatus,
    paymentStatus: resolvedPaymentStatus,
    paymentMethod,
    deliveryContactName,
    deliveryPhone,
    deliveryAddress,
    deliveryNote,
    expectedDeliveryDate,
  };
};

const sanitizeStatusPayload = (payload = {}) => {
  const update = {};

  if (payload.orderStatus) {
    const orderStatus = `${payload.orderStatus}`.trim().toUpperCase();
    if (!ORDER_STATUSES.has(orderStatus)) {
      const error = new Error("Invalid order status");
      error.statusCode = 400;
      throw error;
    }
    update.orderStatus = orderStatus;
  }

  if (payload.paymentStatus) {
    const paymentStatus = `${payload.paymentStatus}`.trim().toUpperCase();
    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      const error = new Error("Invalid payment status");
      error.statusCode = 400;
      throw error;
    }
    update.paymentStatus = paymentStatus;
  }

  if (payload.paymentMethod) {
    const paymentMethod = `${payload.paymentMethod}`.trim().toUpperCase();
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      const error = new Error("Invalid payment method");
      error.statusCode = 400;
      throw error;
    }
    update.paymentMethod = paymentMethod;
  }

  return update;
};

const assertValidStatusTransition = (currentStatus, nextStatus) => {
  const current = `${currentStatus || ""}`.trim().toUpperCase();
  const next = `${nextStatus || ""}`.trim().toUpperCase();
  if (!current || !next || current === next) return;

  const allowed = ORDER_STATUS_TRANSITIONS[current] || new Set();
  if (!allowed.has(next)) {
    const error = new Error(`Invalid order status transition: ${current} -> ${next}`);
    error.statusCode = 400;
    throw error;
  }
};

const syncOrderStockForStatus = async ({ order, targetStatus, userId }) => {
  if (!order || !targetStatus) return order;

  const nextStatus = `${targetStatus}`.trim().toUpperCase();
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) return order;

  if (STOCK_APPLY_STATUSES.has(nextStatus) && !order.stockApplied) {
    for (const item of items) {
      await applyStockTransaction({
        shop: order.shop,
        product: item.item,
        model: item.modelId,
        variation: item.variationId,
        sku: item.sku,
        type: "OUT",
        quantity: Number(item.quantity || 0),
        referenceType: "ORDER",
        referenceId: order._id,
        note: `Order ${order.orderNo || order._id} stock deducted on ${nextStatus}`,
        createdBy: userId || null,
      });
    }

    order.stockApplied = true;
    order.stockAppliedAt = new Date();
    order.stockReleasedAt = null;
    return order;
  }

  if (STOCK_REVERSE_STATUSES.has(nextStatus) && order.stockApplied) {
    for (const item of items) {
      await applyStockTransaction({
        shop: order.shop,
        product: item.item,
        model: item.modelId,
        variation: item.variationId,
        sku: item.sku,
        type: "IN",
        quantity: Number(item.quantity || 0),
        referenceType: "ORDER",
        referenceId: order._id,
        note: `Order ${order.orderNo || order._id} stock restored on ${nextStatus}`,
        createdBy: userId || null,
      });
    }

    order.stockApplied = false;
    order.stockReleasedAt = new Date();
    return order;
  }

  return order;
};

const releaseOrderStock = async ({ order, reason, userId }) => {
  if (!order?.stockApplied) {
    return order;
  }

  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) {
    return order;
  }

  for (const item of items) {
    await applyStockTransaction({
      shop: order.shop,
      product: item.item,
      model: item.modelId,
      variation: item.variationId,
      sku: item.sku,
      type: "IN",
      quantity: Number(item.quantity || 0),
      referenceType: "ORDER",
      referenceId: order._id,
      note: `Order ${order.orderNo || order._id} stock restored on ${reason}`,
      createdBy: userId || null,
    });
  }

  order.stockApplied = false;
  order.stockReleasedAt = new Date();
  return order;
};

exports.getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      perPage = 10,
      search = "",
      orderStatus,
      paymentStatus,
      dateFrom,
      dateTo,
    } = req.query;

    const safePage = Math.max(1, Number(page || 1));
    const safePerPage = Math.min(100, Math.max(1, Number(perPage || 10)));
    const skip = (safePage - 1) * safePerPage;
    const scopeQuery = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    const query = { ...scopeQuery };

    if (orderStatus && orderStatus !== "ALL") {
      query.orderStatus = `${orderStatus}`.trim().toUpperCase();
    }

    if (paymentStatus && paymentStatus !== "ALL") {
      query.paymentStatus = `${paymentStatus}`.trim().toUpperCase();
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        const from = new Date(`${dateFrom}`);
        if (!Number.isNaN(from.getTime())) {
          from.setHours(0, 0, 0, 0);
          query.createdAt.$gte = from;
        }
      }
      if (dateTo) {
        const to = new Date(`${dateTo}`);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          query.createdAt.$lte = to;
        }
      }
      if (!Object.keys(query.createdAt).length) {
        delete query.createdAt;
      }
    }

    const trimmedSearch = `${search || ""}`.trim();
    if (trimmedSearch) {
      const phoneSearch = trimmedSearch.replace(/\D/g, "");
      const customerQuery = {
        ...scopeQuery,
        $or: [{ name: { $regex: trimmedSearch, $options: "i" } }],
      };
      if (phoneSearch) {
        customerQuery.$or.push({ phone: { $regex: phoneSearch, $options: "i" } });
      }

      const customerRows = await Customer.find(customerQuery).select("_id").limit(200).lean();
      const customerIds = customerRows.map((row) => row._id);
      query.$or = [
        { orderNo: { $regex: trimmedSearch, $options: "i" } },
        { "items.productName": { $regex: trimmedSearch, $options: "i" } },
        { "items.modelName": { $regex: trimmedSearch, $options: "i" } },
        { "items.sku": { $regex: trimmedSearch, $options: "i" } },
      ];
      if (customerIds.length) {
        query.$or.push({ customer: { $in: customerIds } });
      }
    }

    const { start: todayStart, end: todayEnd } = getDayBounds();
    const overdueMatch = {
      ...scopeQuery,
      expectedDeliveryDate: {
        $type: "date",
        $lt: todayStart,
      },
      orderStatus: { $in: ["PENDING", "CONFIRMED", "SHIPPED"] },
    };
    const todayOrdersMatch = {
      ...scopeQuery,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    const [orders, totalItems, overviewRows, todayOrderRows, todayCollectionRows, overdueCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(safePerPage)
        .populate("customer", "name phone")
        .populate("shop", "name shopCode")
        .lean(),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: query },
        {
          $project: {
            orderSource: { $ifNull: ["$orderSource", "ONLINE"] },
            orderStatus: { $ifNull: ["$orderStatus", "PENDING"] },
            totalAmount: { $ifNull: ["$totalAmount", 0] },
            paidAmount: { $ifNull: ["$paidAmount", 0] },
            refundedAmount: { $ifNull: ["$refundedAmount", 0] },
            dueAmount: { $ifNull: ["$dueAmount", 0] },
            paymentStatus: { $ifNull: ["$paymentStatus", "PENDING"] },
            totalQuantity: { $ifNull: ["$totalQuantity", 0] },
            totalCostAmount: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$items", []] },
                  as: "item",
                  in: {
                    $multiply: [
                      { $ifNull: ["$$item.purchasePrice", 0] },
                      { $ifNull: ["$$item.quantity", 0] },
                    ],
                  },
                },
              },
            },
            realizedRevenue: {
              $cond: [{ $eq: ["$paymentStatus", "PAID"] }, { $ifNull: ["$totalAmount", 0] }, 0],
            },
            realizedCostAmount: {
              $cond: [
                { $eq: ["$paymentStatus", "PAID"] },
                {
                  $sum: {
                    $map: {
                      input: { $ifNull: ["$items", []] },
                      as: "item",
                      in: {
                        $multiply: [
                          { $ifNull: ["$$item.purchasePrice", 0] },
                          { $ifNull: ["$$item.quantity", 0] },
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            offlineOrders: {
              $sum: {
                $cond: [{ $eq: ["$orderSource", "POS"] }, 1, 0],
              },
            },
            onlineOrders: {
              $sum: {
                $cond: [{ $eq: ["$orderSource", "ONLINE"] }, 1, 0],
              },
            },
            totalQuantity: { $sum: "$totalQuantity" },
            totalAmount: { $sum: "$totalAmount" },
            totalCollected: {
              $sum: {
                $max: [{ $subtract: ["$paidAmount", "$refundedAmount"] }, 0],
              },
            },
            totalDue: { $sum: "$dueAmount" },
            totalCostAmount: { $sum: "$totalCostAmount" },
            realizedRevenue: { $sum: "$realizedRevenue" },
            realizedCostAmount: { $sum: "$realizedCostAmount" },
            deliveryPendingCount: {
              $sum: {
                $cond: [
                  { $in: ["$orderStatus", ["PENDING", "CONFIRMED", "SHIPPED"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        { $match: todayOrdersMatch },
        {
          $group: {
            _id: null,
            todayOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: scopeQuery },
        {
          $project: {
            paymentHistory: {
              $filter: {
                input: { $ifNull: ["$paymentHistory", []] },
                as: "payment",
                cond: {
                  $and: [
                    { $gte: ["$$payment.collectedAt", todayStart] },
                    { $lte: ["$$payment.collectedAt", todayEnd] },
                  ],
                },
              },
            },
          },
        },
        { $unwind: "$paymentHistory" },
        {
          $group: {
            _id: null,
            todayCollection: { $sum: { $ifNull: ["$paymentHistory.amount", 0] } },
          },
        },
      ]),
      Order.countDocuments(overdueMatch),
    ]);

    const overviewBase = overviewRows?.[0] || {};
    const todayOrderBase = todayOrderRows?.[0] || {};
    const todayCollectionBase = todayCollectionRows?.[0] || {};
    const totalAmount = roundAmount(overviewBase.totalAmount || 0);
    const totalCostAmount = roundAmount(overviewBase.totalCostAmount || 0);
    const realizedRevenue = roundAmount(overviewBase.realizedRevenue || 0);
    const realizedCostAmount = roundAmount(overviewBase.realizedCostAmount || 0);
    const totalProfit = roundAmount(realizedRevenue - realizedCostAmount);
    const overview = {
      totalOrders: Number(overviewBase.totalOrders || 0),
      offlineOrders: Number(overviewBase.offlineOrders || 0),
      onlineOrders: Number(overviewBase.onlineOrders || 0),
      totalQuantity: Number(overviewBase.totalQuantity || 0),
      totalAmount,
      totalCollected: roundAmount(overviewBase.totalCollected || 0),
      totalDue: roundAmount(overviewBase.totalDue || 0),
      deliveryPendingCount: Number(overviewBase.deliveryPendingCount || 0),
      todayOrders: Number(todayOrderBase.todayOrders || 0),
      todayCollection: roundAmount(todayCollectionBase.todayCollection || 0),
      overdueDeliveryCount: Number(overdueCount || 0),
      ...(canViewSensitivePricing(req)
        ? {
            totalCostAmount,
            realizedRevenue,
            realizedCostAmount,
            totalProfit,
          }
        : {}),
    };

    return res.status(200).json({
      success: true,
      orders: orders.map((order) => sanitizeOrderPricing(order, req)),
      totalItems,
      overview,
    });
  } catch (err) {
    console.error("Error retrieving orders:", err);
    return res.status(500).json({ success: false, error: "Error retrieving orders" });
  }
};

exports.createOrder = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const draft = await buildOrderDraftFromRequest(req);
    const orderNo = await generateInvoiceNo({ type: "ORDER" });

    const order = await Order.create({
      shop: req.shopId,
      customer: draft.customerId,
      deliveryContactName: draft.deliveryContactName,
      deliveryPhone: draft.deliveryPhone,
      deliveryAddress: draft.deliveryAddress,
      deliveryNote: draft.deliveryNote,
      expectedDeliveryDate: draft.expectedDeliveryDate,
      orderNo,
      items: draft.items,
      totalQuantity: draft.totalQuantity,
      subTotal: draft.subTotal,
      totalDiscount: draft.totalDiscount,
      taxAmount: draft.taxAmount,
      totalAmount: draft.totalAmount,
      paidAmount: draft.paidAmount,
      refundedAmount: 0,
      dueAmount: draft.dueAmount,
      orderSource: draft.orderSource,
      orderStatus: draft.orderStatus,
      paymentStatus: draft.paymentStatus,
      paymentMethod: draft.paymentMethod,
      paymentHistory: buildAdvancePaymentHistory({ draft }),
      shippedAt: draft.orderStatus === "SHIPPED" ? new Date() : null,
      deliveredAt: draft.orderStatus === "DELIVERED" ? new Date() : null,
    });

    await syncOrderStockForStatus({
      order,
      targetStatus: draft.orderStatus,
      userId: req.user?._id,
    });
    await order.save();

    const savedOrder = await Order.findById(order._id)
      .populate("customer", "name phone")
      .populate("shop", "name shopCode")
      .lean();

    await syncOrderLedger({
      order: savedOrder,
      createdBy: req.user?._id,
    });
    if (savedOrder?.customer?._id || savedOrder?.customer) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: savedOrder.customer?._id || savedOrder.customer,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: savedOrder,
    });
  } catch (err) {
    console.error("Error creating order:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Error creating order",
    });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const order = await Order.findOne({ _id: req.params.id, shop: req.shopId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!FULLY_EDITABLE_ORDER_STATUSES.has(`${order.orderStatus || ""}`.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be edited",
      });
    }

    const previousCustomerId = order.customer ? `${order.customer}` : null;
    const draft = await buildOrderDraftFromRequest(req);
    if (!FULLY_EDITABLE_ORDER_STATUSES.has(draft.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: "Edited order must remain in pending status",
      });
    }

    order.customer = draft.customerId;
    order.items = draft.items;
    order.totalQuantity = draft.totalQuantity;
    order.subTotal = draft.subTotal;
    order.totalDiscount = draft.totalDiscount;
    order.taxAmount = draft.taxAmount;
    order.totalAmount = draft.totalAmount;
    order.paidAmount = draft.paidAmount;
    order.refundedAmount = 0;
    order.dueAmount = draft.dueAmount;
    order.orderSource = draft.orderSource;
    order.orderStatus = draft.orderStatus;
    order.paymentStatus = draft.paymentStatus;
    order.paymentMethod = draft.paymentMethod;
    order.paymentHistory = buildAdvancePaymentHistory({ draft, existingOrder: order });
    order.deliveryContactName = draft.deliveryContactName;
    order.deliveryPhone = draft.deliveryPhone;
    order.deliveryAddress = draft.deliveryAddress;
    order.deliveryNote = draft.deliveryNote;
    order.expectedDeliveryDate = draft.expectedDeliveryDate;
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name phone")
      .populate("shop", "name shopCode")
      .lean();

    await syncOrderLedger({
      order: updatedOrder,
      createdBy: req.user?._id,
    });

    const currentCustomerId = updatedOrder?.customer?._id
      ? `${updatedOrder.customer._id}`
      : updatedOrder?.customer
        ? `${updatedOrder.customer}`
        : null;

    if (previousCustomerId) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: previousCustomerId,
      });
    }
    if (currentCustomerId && currentCustomerId !== previousCustomerId) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: currentCustomerId,
      });
    } else if (currentCustomerId) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: currentCustomerId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating order:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Error updating order",
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req)
      ? { _id: req.params.id }
      : { _id: req.params.id, shop: req.shopId };

    const order = await Order.findOne(query)
      .populate("customer", "name phone email")
      .populate("shop", "name shopCode")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({
      success: true,
      order: sanitizeOrderPricing(order, req),
    });
  } catch (err) {
    console.error("Error retrieving order:", err);
    return res.status(500).json({ success: false, error: "Error retrieving order" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const update = sanitizeStatusPayload(req.body);
    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    const order = await Order.findOne({ _id: req.params.id, shop: req.shopId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (update.orderStatus) {
      assertValidStatusTransition(order.orderStatus, update.orderStatus);
      order.orderStatus = update.orderStatus;
      if (update.orderStatus === "SHIPPED" && !order.shippedAt) {
        order.shippedAt = new Date();
      }
      if (update.orderStatus === "DELIVERED" && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }
      if (["CANCELLED", "RETURNED"].includes(update.orderStatus)) {
        const refundableAmount = roundAmount(order.paidAmount || 0);
        order.refundedAmount = refundableAmount;
        order.dueAmount = 0;
        order.paymentStatus = refundableAmount > 0 ? "REFUNDED" : "FAILED";
        order.paymentCollectedAt = new Date();
      }
    }
    if (update.paymentStatus) {
      order.paymentStatus = update.paymentStatus;
      if (update.paymentStatus === "FAILED") {
        order.paidAmount = 0;
        order.refundedAmount = 0;
        order.dueAmount = roundAmount(order.totalAmount || 0);
        order.paymentHistory = [];
        order.paymentCollectedAt = new Date();
        await releaseOrderStock({
          order,
          reason: "FAILED PAYMENT",
          userId: req.user?._id,
        });
      }
      if (update.paymentStatus === "REFUNDED") {
        const refundableAmount = roundAmount(order.paidAmount || 0);
        order.refundedAmount = refundableAmount;
        order.dueAmount = 0;
        order.paymentCollectedAt = new Date();
        await releaseOrderStock({
          order,
          reason: "REFUND",
          userId: req.user?._id,
        });
      }
    }
    if (update.paymentMethod) {
      order.paymentMethod = update.paymentMethod;
    }

    await syncOrderStockForStatus({
      order,
      targetStatus: order.orderStatus,
      userId: req.user?._id,
    });
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name phone")
      .populate("shop", "name shopCode")
      .lean();

    await syncOrderLedger({
      order: updatedOrder,
      createdBy: req.user?._id,
    });
    if (updatedOrder?.customer?._id || updatedOrder?.customer) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: updatedOrder.customer?._id || updatedOrder.customer,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("Error updating order:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Error updating order",
    });
  }
};

exports.collectOrderPayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const paymentMethod = `${req.body?.paymentMethod || "CASH"}`.trim().toUpperCase();
    const amount = Math.max(0, roundAmount(req.body?.amount || 0));
    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid payment amount" });
    }

    const note = `${req.body?.note || ""}`.trim();
    const order = await Order.findOne({ _id: req.params.id, shop: req.shopId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (Number(order.dueAmount || 0) <= 0 || `${order.paymentStatus || ""}`.toUpperCase() === "PAID") {
      return res.status(400).json({ success: false, message: "Order is already fully paid" });
    }
    if (amount > Number(order.dueAmount || 0)) {
      return res.status(400).json({ success: false, message: "Payment cannot exceed due amount" });
    }

    order.paidAmount = roundAmount(Number(order.paidAmount || 0) + amount);
    order.dueAmount = roundAmount(Math.max(0, Number(order.totalAmount || 0) - Number(order.paidAmount || 0)));
    order.paymentStatus = order.dueAmount <= 0 ? "PAID" : "PENDING";
    order.paymentMethod = paymentMethod;
    order.paymentNote = note;
    order.paymentCollectedAt = new Date();
    order.paymentHistory = [
      ...(Array.isArray(order.paymentHistory) ? order.paymentHistory : []),
      buildPaymentHistoryEntry({
        amount,
        paymentMethod,
        note: note || `Payment collected for ${order.orderNo || order._id}`,
        collectedAt: order.paymentCollectedAt,
      }),
    ];
    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate("customer", "name phone")
      .populate("shop", "name shopCode")
      .lean();

    await syncOrderLedger({
      order: updatedOrder,
      createdBy: req.user?._id,
    });
    if (updatedOrder?.customer?._id || updatedOrder?.customer) {
      await syncCustomerAccountSnapshot({
        shopId: req.shopId,
        customerId: updatedOrder.customer?._id || updatedOrder.customer,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order payment collected successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("Error collecting order payment:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Error collecting order payment",
    });
  }
};
