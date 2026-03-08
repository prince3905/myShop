const OrderLedger = require("../models/OrderLedger");

const roundAmount = (value) => Number(Number(value || 0).toFixed(2));

const ensureEntry = async ({
  shop,
  order,
  customer,
  customerName,
  type,
  amount,
  paymentMethod,
  note,
  createdBy,
}) => {
  return OrderLedger.findOneAndUpdate(
    { shop, order, type },
    {
      $set: {
        customer,
        customerName,
        amount: roundAmount(amount),
        paymentMethod: paymentMethod || undefined,
        note: note || "",
        createdBy: createdBy || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

const removeEntry = async ({ shop, order, type }) => {
  await OrderLedger.deleteOne({ shop, order, type });
};

const syncOrderLedger = async ({ order, createdBy = null }) => {
  if (!order?.shop || !order?._id || !order?.customer) {
    return;
  }

  const amount = roundAmount(order.totalAmount || 0);
  const shop = order.shop;
  const orderId = order._id;
  const customer = order.customer?._id || order.customer;
  const customerName = order.customer?.name || "";

  await ensureEntry({
    shop,
    order: orderId,
    customer,
    customerName,
    type: "order",
    amount,
    note: `Order ${order.orderNo || orderId}`,
    createdBy,
  });

  if (Number(order.paidAmount || 0) > 0 || ["PAID", "REFUNDED"].includes(`${order.paymentStatus || ""}`.toUpperCase())) {
    await ensureEntry({
      shop,
      order: orderId,
      customer,
      customerName,
      type: "payment",
      amount: roundAmount(order.paidAmount || amount),
      paymentMethod: order.paymentMethod || undefined,
      note: order.paymentNote || `Order payment ${order.orderNo || orderId}`,
      createdBy,
    });
  } else {
    await removeEntry({ shop, order: orderId, type: "payment" });
  }

  if (`${order.orderStatus || ""}`.toUpperCase() === "CANCELLED") {
    await ensureEntry({
      shop,
      order: orderId,
      customer,
      customerName,
      type: "cancellation",
      amount,
      note: `Order cancelled ${order.orderNo || orderId}`,
      createdBy,
    });
  } else {
    await removeEntry({ shop, order: orderId, type: "cancellation" });
  }

  if (`${order.orderStatus || ""}`.toUpperCase() === "RETURNED") {
    await ensureEntry({
      shop,
      order: orderId,
      customer,
      customerName,
      type: "return",
      amount,
      note: `Order returned ${order.orderNo || orderId}`,
      createdBy,
    });
  } else {
    await removeEntry({ shop, order: orderId, type: "return" });
  }

  if (`${order.paymentStatus || ""}`.toUpperCase() === "REFUNDED") {
    await ensureEntry({
      shop,
      order: orderId,
      customer,
      customerName,
      type: "refund",
      amount: roundAmount(order.refundedAmount || order.paidAmount || 0),
      paymentMethod: order.paymentMethod || undefined,
      note: `Order refund ${order.orderNo || orderId}`,
      createdBy,
    });
  } else {
    await removeEntry({ shop, order: orderId, type: "refund" });
  }
};

module.exports = {
  syncOrderLedger,
};
