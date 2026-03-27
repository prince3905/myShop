const mongoose = require("mongoose");
const Distributor = require("../models/Distributor");
const RawMaterial = require("../models/RawMaterial");
const RawMaterialPurchase = require("../models/RawMaterialPurchase");
const { generateInvoiceNo } = require("../utils/invoice.service");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizePaymentMethod = (value) => {
  const normalized = `${value || "CASH"}`.trim().toUpperCase();
  return ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"].includes(normalized)
    ? normalized
    : "CASH";
};

const buildNormalizedItems = async (shopId, items = []) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => ({
    rawMaterial: `${item?.rawMaterial || ""}`.trim(),
    orderedQty: toNumber(item?.orderedQty, 0),
    receivedQty: toNumber(item?.receivedQty ?? item?.orderedQty, 0),
    rate: toNumber(item?.rate, 0),
    note: `${item?.note || ""}`.trim(),
  }));

  if (!normalizedItems.length) {
    return { error: "At least one raw material item is required", items: [] };
  }

  const rawMaterialIds = normalizedItems.map((item) => item.rawMaterial).filter(Boolean);
  if (!rawMaterialIds.length) {
    return { error: "Please select raw materials", items: [] };
  }

  const uniqueIds = [...new Set(rawMaterialIds)];
  const rawMaterials = await RawMaterial.find({
    _id: { $in: uniqueIds },
    shop: shopId,
    isDeleted: false,
  }).select("_id name unitLabel currentRate active");

  if (rawMaterials.length !== uniqueIds.length) {
    return { error: "One or more raw materials are invalid for selected shop", items: [] };
  }

  const rawMaterialMap = new Map(rawMaterials.map((material) => [`${material._id}`, material]));

  const itemsWithMaterial = [];
  for (const item of normalizedItems) {
    const material = rawMaterialMap.get(item.rawMaterial);
    if (!material) {
      return { error: "One or more raw materials are invalid for selected shop", items: [] };
    }
    if (item.orderedQty <= 0) {
      return { error: `Ordered quantity must be greater than 0 for ${material.name}`, items: [] };
    }
    if (item.receivedQty < 0) {
      return { error: `Received quantity cannot be negative for ${material.name}`, items: [] };
    }
    if (item.rate < 0) {
      return { error: `Rate cannot be negative for ${material.name}`, items: [] };
    }

    itemsWithMaterial.push({
      rawMaterial: material._id,
      materialName: material.name,
      unitLabel: material.unitLabel || "PCS",
      orderedQty: item.orderedQty,
      receivedQty: item.receivedQty,
      rate: item.rate,
      totalAmount: item.receivedQty * item.rate,
      note: item.note,
    });
  }

  return { error: null, items: itemsWithMaterial };
};

const buildQuery = (req) => {
  const query = {
    shop: req.shopId,
    isDeleted: false,
  };

  if (STAFF_ONLY_FILTER(req)) {
    query.createdBy = req.user._id;
  }

  const { status, search, distributor, dateFrom, dateTo } = req.query || {};
  if (`${status || ""}`.trim()) query.status = `${status}`.trim().toUpperCase();
  if (`${distributor || ""}`.trim()) query.distributor = `${distributor}`.trim();
  if (`${search || ""}`.trim()) {
    const regex = new RegExp(`${search}`.trim(), "i");
    query.$or = [
      { invoiceNo: regex },
      { note: regex },
      { "items.materialName": regex },
    ];
  }

  const from = normalizeDate(dateFrom);
  const to = normalizeDate(dateTo);
  if (from || to) {
    query.purchaseDate = {};
    if (from) query.purchaseDate.$gte = from;
    if (to) {
      to.setHours(23, 59, 59, 999);
      query.purchaseDate.$lte = to;
    }
  }

  return query;
};

exports.createPurchase = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const distributorId = `${req.body?.distributor || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(distributorId)) {
      return res.status(400).json({ success: false, message: "Please select a distributor" });
    }

    const distributor = await Distributor.findOne({ _id: distributorId, shop: req.shopId, isDeleted: { $ne: true } });
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor not found for selected shop" });
    }

    const { error, items } = await buildNormalizedItems(req.shopId, req.body?.items || []);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const subtotal = items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const paidAmount = Math.max(0, toNumber(req.body?.paidAmount, 0));
    if (paidAmount > subtotal) {
      return res.status(400).json({ success: false, message: "Paid amount cannot be greater than purchase value" });
    }
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);

    const normalizedInvoiceNo = `${req.body?.invoiceNo || ""}`.trim()
      || (await generateInvoiceNo({ type: "RAW_MATERIAL_PURCHASE" }));

    const purchase = await RawMaterialPurchase.create({
      shop: req.shopId,
      distributor: distributor._id,
      invoiceNo: normalizedInvoiceNo,
      purchaseDate: normalizeDate(req.body?.purchaseDate) || new Date(),
      status: "PENDING_RECEIPT",
      items,
      subtotal,
      paidAmount,
      paymentMethod,
      dueAmount: Math.max(0, subtotal - paidAmount),
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    });

    const populated = await RawMaterialPurchase.findById(purchase._id)
      .populate("distributor", "name phone shopName")
      .populate("createdBy", "email role pFname pLname")
      .lean();

    return res.status(201).json({ success: true, message: "Raw material purchase saved", purchase: populated });
  } catch (error) {
    console.error("Create Raw Material Purchase Error:", error);
    if (error?.code === 11000 && error?.keyPattern?.invoiceNo) {
      return res.status(409).json({ success: false, message: "Invoice number already exists for this shop" });
    }
    return res.status(500).json({ success: false, message: "Failed to save raw material purchase" });
  }
};

exports.listPurchases = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const purchases = await RawMaterialPurchase.find(buildQuery(req))
      .sort({ purchaseDate: -1, createdAt: -1 })
      .populate("distributor", "name phone shopName")
      .populate("createdBy", "email role pFname pLname")
      .populate("approvedBy", "email role pFname pLname")
      .lean();

    const summary = purchases.reduce((acc, purchase) => {
      acc.totalPurchases += 1;
      acc.totalValue += Number(purchase?.subtotal || 0);
      acc.totalPaid += Number(purchase?.paidAmount || 0);
      acc.totalDue += Number(purchase?.dueAmount || 0);
      if (`${purchase?.status || ""}` === "PENDING_RECEIPT") acc.pendingCount += 1;
      if (`${purchase?.status || ""}` === "APPROVED") acc.approvedCount += 1;
      if (`${purchase?.status || ""}` === "CANCELLED") acc.cancelledCount += 1;
      acc.totalReceivedQty += (purchase?.items || []).reduce((sum, item) => sum + Number(item?.receivedQty || 0), 0);
      return acc;
    }, {
      totalPurchases: 0,
      pendingCount: 0,
      approvedCount: 0,
      cancelledCount: 0,
      totalValue: 0,
      totalPaid: 0,
      totalDue: 0,
      totalReceivedQty: 0,
    });

    return res.json({ success: true, purchases, summary });
  } catch (error) {
    console.error("List Raw Material Purchases Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load raw material purchases" });
  }
};

exports.updatePurchase = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const purchase = await RawMaterialPurchase.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Raw material purchase not found" });
    }
    if (purchase.status !== "PENDING_RECEIPT") {
      return res.status(400).json({ success: false, message: "Only pending receipt can be edited" });
    }

    const distributorId = `${req.body?.distributor || purchase.distributor || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(distributorId)) {
      return res.status(400).json({ success: false, message: "Please select a distributor" });
    }

    const distributor = await Distributor.findOne({ _id: distributorId, shop: req.shopId, isDeleted: { $ne: true } });
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor not found for selected shop" });
    }

    const { error, items } = await buildNormalizedItems(req.shopId, req.body?.items || []);
    if (error) {
      return res.status(400).json({ success: false, message: error });
    }
    const subtotal = items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const paidAmount = Math.max(0, toNumber(req.body?.paidAmount ?? purchase.paidAmount, 0));
    if (paidAmount > subtotal) {
      return res.status(400).json({ success: false, message: "Paid amount cannot be greater than purchase value" });
    }
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod || purchase.paymentMethod);

    purchase.distributor = distributor._id;
    purchase.invoiceNo = `${req.body?.invoiceNo || ""}`.trim()
      || purchase.invoiceNo
      || (await generateInvoiceNo({ type: "RAW_MATERIAL_PURCHASE" }));
    purchase.purchaseDate = normalizeDate(req.body?.purchaseDate) || purchase.purchaseDate || new Date();
    purchase.items = items;
    purchase.subtotal = subtotal;
    purchase.paidAmount = paidAmount;
    purchase.paymentMethod = paymentMethod;
    purchase.dueAmount = Math.max(0, subtotal - paidAmount);
    purchase.note = `${req.body?.note || ""}`.trim();
    purchase.updatedBy = req.user._id;

    await purchase.save();

    return res.json({ success: true, message: "Raw material purchase updated" });
  } catch (error) {
    console.error("Update Raw Material Purchase Error:", error);
    if (error?.code === 11000 && error?.keyPattern?.invoiceNo) {
      return res.status(409).json({ success: false, message: "Invoice number already exists for this shop" });
    }
    return res.status(500).json({ success: false, message: "Failed to update raw material purchase" });
  }
};

exports.approvePurchase = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const purchase = await RawMaterialPurchase.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Raw material purchase not found" });
    }
    if (purchase.status === "APPROVED") {
      return res.status(409).json({ success: false, message: "Purchase already approved" });
    }
    if (purchase.status === "CANCELLED") {
      return res.status(400).json({ success: false, message: "Cancelled purchase cannot be approved" });
    }

    const approvalTime = new Date();
    purchase.status = "APPROVED";
    purchase.approvedAt = approvalTime;
    purchase.approvedBy = req.user._id;
    purchase.updatedBy = req.user._id;
    await purchase.save();

    await createDistributorLedgerEntry({
      shop: req.shopId,
      distributor: purchase.distributor,
      type: "purchase",
      amount: Number(purchase.subtotal || 0),
      referenceId: purchase._id,
      note: `Raw Material Purchase ${purchase.invoiceNo || ""}`.trim(),
      transactionDate: approvalTime,
      createdBy: req.user._id,
    });

    if (Number(purchase.paidAmount || 0) > 0) {
      await createDistributorLedgerEntry({
        shop: req.shopId,
        distributor: purchase.distributor,
        type: "payment",
        amount: Number(purchase.paidAmount || 0),
        paymentMethod: purchase.paymentMethod || "CASH",
        referenceId: purchase._id,
        note: `Raw Material Purchase Payment ${purchase.invoiceNo || ""}`.trim(),
        transactionDate: approvalTime,
        createdBy: req.user._id,
      });
    }

    return res.json({ success: true, message: "Material receipt approved" });
  } catch (error) {
    console.error("Approve Raw Material Purchase Error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve raw material purchase" });
  }
};

exports.addPayment = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const purchase = await RawMaterialPurchase.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Raw material purchase not found" });
    }

    if (purchase.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Payment can be added only after receipt approval" });
    }

    const amount = Math.max(0, toNumber(req.body?.amount, 0));
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    }

    const currentDue = Math.max(0, Number(purchase.dueAmount || 0));
    if (amount > currentDue) {
      return res.status(400).json({ success: false, message: `Payment cannot exceed due amount ${currentDue.toFixed(2)}` });
    }

    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    const note = `${req.body?.note || ""}`.trim() || `Raw Material Purchase Payment ${purchase.invoiceNo || ""}`.trim();

    await createDistributorLedgerEntry({
      shop: req.shopId,
      distributor: purchase.distributor,
      type: "payment",
      amount,
      paymentMethod,
      referenceId: purchase._id,
      note,
      transactionDate: new Date(),
      createdBy: req.user._id,
    });

    purchase.paidAmount = Math.max(0, Number(purchase.paidAmount || 0) + amount);
    purchase.dueAmount = Math.max(0, Number(purchase.subtotal || 0) - Number(purchase.paidAmount || 0));
    purchase.paymentMethod = paymentMethod;
    purchase.updatedBy = req.user._id;
    await purchase.save();

    return res.json({ success: true, message: "Payment added successfully" });
  } catch (error) {
    console.error("Raw Material Purchase Add Payment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add payment" });
  }
};

exports.cancelPurchase = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const purchase = await RawMaterialPurchase.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Raw material purchase not found" });
    }
    if (purchase.status === "APPROVED") {
      return res.status(400).json({ success: false, message: "Approved purchase cannot be cancelled" });
    }

    purchase.status = "CANCELLED";
    purchase.updatedBy = req.user._id;
    await purchase.save();

    return res.json({ success: true, message: "Raw material purchase cancelled" });
  } catch (error) {
    console.error("Cancel Raw Material Purchase Error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel raw material purchase" });
  }
};
