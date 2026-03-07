const mongoose = require("mongoose");
const Order = require("../models/Order");
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
const PAYMENT_METHODS = new Set(["CASH", "UPI", "CARD", "BANK_TRANSFER"]);
const ORDER_SOURCES = new Set(["POS", "ONLINE"]);

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitivePricing = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

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
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

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
        ...(isSuperAdminGlobal(req) ? {} : { shop: req.shopId }),
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

    const [orders, totalItems] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(safePerPage)
        .populate("customer", "name phone")
        .populate("shop", "name shopCode")
        .lean(),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      orders: orders.map((order) => sanitizeOrderPricing(order, req)),
      totalItems,
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

    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!payloadItems.length) {
      return res.status(400).json({ success: false, message: "items[] is required" });
    }

    let customer = null;
    if (req.body?.customerId) {
      if (!mongoose.Types.ObjectId.isValid(`${req.body.customerId}`)) {
        return res.status(400).json({ success: false, message: "Invalid customer id" });
      }

      customer = await Customer.findOne({
        _id: req.body.customerId,
        shop: req.shopId,
        isDeleted: { $ne: true },
      }).select("_id");

      if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }
    }

    const items = [];
    let subTotal = 0;
    let itemLevelDiscount = 0;
    let totalQuantity = 0;

    for (const rawItem of payloadItems) {
      const variation = await resolveVariation(req.shopId, rawItem);
      if (!variation) {
        return res.status(400).json({
          success: false,
          message: `Variation not found for item ${rawItem?.sku || rawItem?.variationSku || rawItem?.variationId || "unknown"}`,
        });
      }

      const quantity = Math.max(0, Number(rawItem?.quantity || 0));
      if (quantity <= 0) {
        return res.status(400).json({ success: false, message: "Item quantity must be greater than 0" });
      }

      const sellingPrice = Math.max(0, Number(rawItem?.sellingPrice ?? variation.sellingPrice ?? 0));
      const grossLineTotal = roundAmount(quantity * sellingPrice);
      const discountAmount = Math.max(0, roundAmount(rawItem?.discountAmount || 0));

      if (discountAmount > grossLineTotal) {
        return res.status(400).json({
          success: false,
          message: `Discount cannot exceed line total for SKU ${variation.sku}`,
        });
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
      return res.status(400).json({ success: false, message: "Total discount cannot exceed subtotal" });
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
      return res.status(400).json({ success: false, message: "Invalid order source" });
    }
    if (!ORDER_STATUSES.has(orderStatus)) {
      return res.status(400).json({ success: false, message: "Invalid order status" });
    }
    if (!PAYMENT_STATUSES.has(paymentStatus)) {
      return res.status(400).json({ success: false, message: "Invalid payment status" });
    }
    if (paymentMethod && !PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }
    if (expectedDeliveryDate && Number.isNaN(expectedDeliveryDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid expected delivery date" });
    }

    const totalAmount = roundAmount(subTotal - discountBeforeTax + taxAmount);
    const requestedPaidAmount = Math.max(0, roundAmount(req.body?.paidAmount || 0));
    if (requestedPaidAmount > totalAmount) {
      return res.status(400).json({ success: false, message: "Paid amount cannot exceed total amount" });
    }
    const paidAmount = paymentStatus === "PAID" ? totalAmount : requestedPaidAmount;
    const dueAmount = roundAmount(Math.max(0, totalAmount - paidAmount));
    const resolvedPaymentStatus = dueAmount <= 0 && totalAmount > 0 ? "PAID" : paymentStatus;
    const orderNo = await generateInvoiceNo({ type: "ORDER" });

    const order = await Order.create({
      shop: req.shopId,
      customer: customer?._id || undefined,
      deliveryContactName,
      deliveryPhone,
      deliveryAddress,
      deliveryNote,
      expectedDeliveryDate,
      orderNo,
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
      shippedAt: orderStatus === "SHIPPED" ? new Date() : null,
      deliveredAt: orderStatus === "DELIVERED" ? new Date() : null,
    });

    await syncOrderStockForStatus({
      order,
      targetStatus: orderStatus,
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
    return res.status(500).json({ success: false, error: "Error creating order" });
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
    }
    if (update.paymentStatus) {
      order.paymentStatus = update.paymentStatus;
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
