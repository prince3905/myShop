const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const ProductVariation = require("../models/ProductVariation");
const Product = require("../models/Product");
const ProductModel = require("../models/ProductModel");
const StockTransaction = require("../models/StockTransaction");
const StockReconciliation = require("../models/StockReconciliation");
const { applyStockTransaction } = require("../utils/stock.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitivePricing = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const sanitizeStockRow = (row, req) => {
  if (!row || canViewSensitivePricing(req)) {
    return row;
  }

  const plainRow = row.toObject?.() || { ...row };
  delete plainRow.lastPurchasePrice;
  return plainRow;
};

const getMonthKey = (value) => {
  if (!value) {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
  }
  const v = `${value}`.trim();
  if (/^\d{4}-\d{2}$/.test(v)) return v;
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, "0")}`;
};

const buildSummary = (lines = []) => {
  const totalLines = lines.length;
  const matchedLines = lines.filter((l) => Number(l?.varianceQty || 0) === 0).length;
  const mismatchLines = totalLines - matchedLines;
  const totalSystemQty = lines.reduce((acc, l) => acc + Number(l?.systemQty || 0), 0);
  const totalCountedQty = lines.reduce((acc, l) => acc + Number(l?.countedQty || 0), 0);
  const totalVarianceQty = lines.reduce((acc, l) => acc + Number(l?.varianceQty || 0), 0);
  return {
    totalLines,
    matchedLines,
    mismatchLines,
    totalSystemQty,
    totalCountedQty,
    totalVarianceQty,
  };
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    query.$expr = { $and: [{ $lte: ["$quantity", "$reorderLevel"] }, { $gt: ["$reorderLevel", 0] }] };

    const items = await Stock.find(query)
      .limit(50)
      .sort({ quantity: 1 })
      .populate("product", "name")
      .populate("variation", "sku attributes")
      .lean();

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching low stock alerts",
      error: "Internal server error",
    });
  }
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    // Check where current quantity is less than or equal to reorder level
    // And reorder level is actually set (> 0)
    query.$expr = { $and: [{ $lte: ["$quantity", "$reorderLevel"] }, { $gt: ["$reorderLevel", 0] }] };

    const items = await Stock.find(query)
      .limit(50)
      .sort({ quantity: 1 }) // Show lowest stock first
      .populate("product", "name")
      .populate("model", "name")
      .populate("variation", "sku")
      .lean();

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching low stock alerts",
      error: "Internal server error",
    });
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      lowStock = "false",
      variation,
      sortBy = "updatedAt",
      order = "desc",
    } = req.query;

    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;
    const sortDir = order === "asc" ? 1 : -1;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (variation && mongoose.Types.ObjectId.isValid(`${variation}`)) {
      query.variation = variation;
    }
    if (search) {
      const regex = new RegExp(search, "i");
      const [productMatches, modelMatches] = await Promise.all([
        Product.find({ name: regex }).select("_id").lean(),
        ProductModel.find({ name: regex }).select("_id").lean(),
      ]);

      const productIds = productMatches.map((p) => p._id);
      const modelIds = modelMatches.map((m) => m._id);

      query.$or = [{ sku: regex }];
      if (productIds.length) query.$or.push({ product: { $in: productIds } });
      if (modelIds.length) query.$or.push({ model: { $in: modelIds } });
    }

    if (String(lowStock) === "true") {
      query.$expr = { $lte: ["$quantity", "$reorderLevel"] };
    }

    const [rows, total] = await Promise.all([
      Stock.find(query)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(safeLimit)
        .populate("shop", "name shopCode")
        .populate("product", "name")
        .populate("model", "name")
        .populate("variation", "sku attributes"),
      Stock.countDocuments(query),
    ]);

    const summaryRows = await Stock.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalReserved: { $sum: "$reservedQuantity" },
          totalDamaged: { $sum: "$damagedQuantity" },
          totalCostValue: { $sum: { $multiply: ["$quantity", "$lastPurchasePrice"] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ["$quantity", "$reorderLevel"] }, 1, 0],
            },
          },
        },
      },
    ]);
    const summary = summaryRows[0] || {};

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      stockReport: rows.map((row) => sanitizeStockRow(row, req)),
      summary: {
        totalQuantity: Number(summary.totalQuantity || 0),
        totalReserved: Number(summary.totalReserved || 0),
        totalDamaged: Number(summary.totalDamaged || 0),
        lowStockCount: Number(summary.lowStockCount || 0),
        ...(canViewSensitivePricing(req)
          ? { totalCostValue: Number(summary.totalCostValue || 0) }
          : {}),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving stock report",
      error: "Internal server error",
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 20, variation, type, referenceType, search = "" } = req.query;
    const safePage = Math.max(1, Number(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Number(limit || 20)));
    const skip = (safePage - 1) * safeLimit;

    const query = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };
    if (variation) query.variation = variation;
    if (type) query.type = type;
    if (referenceType) query.referenceType = referenceType;
    if (search) query.sku = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      StockTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate("shop", "name shopCode")
        .populate("product", "name")
        .populate("model", "name")
        .populate("variation", "sku attributes")
        .populate("createdBy", "email role"),
      StockTransaction.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving stock transactions",
      error: "Internal server error",
    });
  }
};

exports.manualAdjust = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { variation, type = "ADJUSTMENT", quantity, note = "", damageSource } = req.body;
    if (!variation || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "variation and quantity are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(variation)) {
      return res.status(400).json({ success: false, message: "Invalid variation id" });
    }

    const variationDoc = await ProductVariation.findOne({
      _id: variation,
      shop: req.shopId,
    });

    if (!variationDoc) {
      return res.status(404).json({ success: false, message: "Variation not found for selected shop" });
    }

    const normalizedType = `${type || ""}`.trim().toUpperCase();
    let stock;
    let tx;

    if (["DAMAGED", "RESTORE_DAMAGE"].includes(normalizedType)) {
      const normalizedDamageSource = `${damageSource || ""}`.trim().toUpperCase();
      const resolvedDamageSource =
        normalizedType === "DAMAGED"
          ? (["PURCHASE_DAMAGE", "INTERNAL_DAMAGE", "CUSTOMER_RETURN_DAMAGE", "OTHER_DAMAGE"].includes(normalizedDamageSource)
              ? normalizedDamageSource
              : "INTERNAL_DAMAGE")
          : undefined;
      stock = await Stock.findOne({ shop: req.shopId, variation: variationDoc._id });
      if (!stock) {
        stock = await Stock.create({
          shop: req.shopId,
          product: variationDoc.product,
          model: variationDoc.model,
          variation: variationDoc._id,
          sku: variationDoc.sku,
          quantity: Number(variationDoc.quantity || 0),
          damagedQuantity: 0,
          reservedQuantity: 0,
        });
      }

      const adjustQty = Math.max(0, Number(quantity || 0));
      const currentDamaged = Number(stock.damagedQuantity || 0);
      const onHandQty = Number(stock.quantity || 0);
      const reservedQty = Number(stock.reservedQuantity || 0);
      const maxDamageable = Math.max(0, onHandQty - reservedQty);

      let nextDamaged = currentDamaged;
      if (normalizedType === "DAMAGED") {
        nextDamaged = currentDamaged + adjustQty;
        if (nextDamaged > maxDamageable) {
          return res.status(400).json({
            success: false,
            message: "Damaged quantity cannot exceed sellable stock",
          });
        }
      } else {
        nextDamaged = Math.max(0, currentDamaged - adjustQty);
      }

      stock.product = variationDoc.product;
      stock.model = variationDoc.model;
      stock.sku = variationDoc.sku;
      stock.damagedQuantity = nextDamaged;
      await stock.save();

      tx = await StockTransaction.create({
        shop: req.shopId,
        product: variationDoc.product,
        model: variationDoc.model,
        variation: variationDoc._id,
        sku: variationDoc.sku,
        type: normalizedType,
        quantity: adjustQty,
        deltaQuantity: 0,
        previousQuantity: onHandQty,
        newQuantity: onHandQty,
        referenceType: "MANUAL",
        note:
          note ||
          (normalizedType === "DAMAGED"
            ? resolvedDamageSource === "PURCHASE_DAMAGE"
              ? "Marked as damaged (received from distributor)"
              : resolvedDamageSource === "CUSTOMER_RETURN_DAMAGE"
                ? "Marked as damaged (customer return)"
                : resolvedDamageSource === "OTHER_DAMAGE"
                  ? "Marked as damaged (other source)"
                  : "Marked as damaged (internal damage)"
            : "Restored from damaged"),
        damageSource: normalizedType === "DAMAGED" ? resolvedDamageSource : undefined,
        createdBy: req.user?._id,
      });
    } else {
      ({ stock, tx } = await applyStockTransaction({
        shop: req.shopId,
        product: variationDoc.product,
        model: variationDoc.model,
        variation: variationDoc._id,
        sku: variationDoc.sku,
        type: normalizedType,
        quantity: Number(quantity),
        referenceType: "MANUAL",
        note,
        createdBy: req.user?._id,
      }));
    }

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: { stock, transaction: tx },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error adjusting stock",
      error: "Internal server error",
    });
  }
};

exports.startReconciliation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const monthKey = getMonthKey(req.body?.monthKey);
    if (!monthKey) {
      return res.status(400).json({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    const existing = await StockReconciliation.findOne({
      shop: req.shopId,
      monthKey,
    }).populate("createdBy submittedBy approvedBy", "email role");
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Reconciliation already exists",
        data: existing,
      });
    }

    const stockRows = await Stock.find({ shop: req.shopId })
      .populate("product", "name")
      .populate("model", "name")
      .populate("variation", "sku")
      .sort({ sku: 1 });

    const lines = stockRows.map((row) => {
      const systemQty = Number(row?.quantity || 0);
      return {
        variation: row.variation?._id || row.variation,
        product: row.product?._id || row.product,
        model: row.model?._id || row.model,
        sku: row.sku || row?.variation?.sku || "-",
        productName: row?.product?.name || "",
        modelName: row?.model?.name || "",
        systemQty,
        countedQty: systemQty,
        varianceQty: 0,
        note: "",
      };
    });

    const reconciliation = await StockReconciliation.create({
      shop: req.shopId,
      monthKey,
      status: "DRAFT",
      lines,
      summary: buildSummary(lines),
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: "Stock reconciliation draft created",
      data: reconciliation,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Reconciliation already exists for this month",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Error creating stock reconciliation",
      error: "Internal server error",
    });
  }
};

exports.getCurrentReconciliation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const monthKey = getMonthKey(req.query?.monthKey);
    if (!monthKey) {
      return res.status(400).json({ success: false, message: "Invalid month format. Use YYYY-MM." });
    }

    const row = await StockReconciliation.findOne({
      shop: req.shopId,
      monthKey,
    }).populate("createdBy submittedBy approvedBy", "email role");

    return res.status(200).json({
      success: true,
      data: row || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching stock reconciliation",
      error: "Internal server error",
    });
  }
};

exports.saveReconciliationLines = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid reconciliation id" });
    }

    const payloadLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (!payloadLines.length) {
      return res.status(400).json({ success: false, message: "lines[] is required" });
    }

    const reconciliation = await StockReconciliation.findOne({ _id: id, shop: req.shopId });
    if (!reconciliation) {
      return res.status(404).json({ success: false, message: "Reconciliation not found" });
    }
    if (reconciliation.status !== "DRAFT") {
      return res.status(409).json({ success: false, message: "Only DRAFT reconciliation can be edited" });
    }

    const incoming = new Map();
    payloadLines.forEach((line) => {
      const key = `${line?.variation || ""}`.trim();
      if (!key) return;
      incoming.set(key, line);
    });

    reconciliation.lines = (reconciliation.lines || []).map((line) => {
      const key = `${line?.variation || ""}`;
      const inLine = incoming.get(key);
      if (!inLine) return line;
      const countedQty = Math.max(0, Number(inLine?.countedQty ?? line.countedQty ?? line.systemQty ?? 0));
      const systemQty = Number(line?.systemQty || 0);
      return {
        ...line.toObject(),
        countedQty,
        varianceQty: countedQty - systemQty,
        note: `${inLine?.note || line?.note || ""}`.trim(),
      };
    });

    reconciliation.summary = buildSummary(reconciliation.lines || []);
    await reconciliation.save();

    return res.status(200).json({
      success: true,
      message: "Reconciliation draft saved",
      data: reconciliation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error saving reconciliation draft",
      error: "Internal server error",
    });
  }
};

exports.submitReconciliation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid reconciliation id" });
    }

    const reconciliation = await StockReconciliation.findOne({ _id: id, shop: req.shopId });
    if (!reconciliation) {
      return res.status(404).json({ success: false, message: "Reconciliation not found" });
    }
    if (reconciliation.status !== "DRAFT") {
      return res.status(409).json({ success: false, message: "Only DRAFT can be submitted" });
    }

    reconciliation.status = "SUBMITTED";
    reconciliation.submittedAt = new Date();
    reconciliation.submittedBy = req.user?._id;
    reconciliation.summary = buildSummary(reconciliation.lines || []);
    await reconciliation.save();

    return res.status(200).json({
      success: true,
      message: "Reconciliation submitted for approval",
      data: reconciliation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error submitting reconciliation",
      error: "Internal server error",
    });
  }
};

exports.approveReconciliation = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid reconciliation id" });
    }

    const reconciliation = await StockReconciliation.findOne({ _id: id, shop: req.shopId });
    if (!reconciliation) {
      return res.status(404).json({ success: false, message: "Reconciliation not found" });
    }
    if (reconciliation.status === "APPROVED") {
      return res.status(409).json({ success: false, message: "Reconciliation already approved" });
    }
    if (reconciliation.status !== "SUBMITTED") {
      return res.status(409).json({ success: false, message: "Only SUBMITTED reconciliation can be approved" });
    }

    const stockRows = await Stock.find({
      shop: req.shopId,
      variation: { $in: (reconciliation.lines || []).map((l) => l.variation) },
    }).select("variation quantity");
    const stockMap = new Map(stockRows.map((s) => [`${s.variation}`, Number(s.quantity || 0)]));

    for (const line of reconciliation.lines || []) {
      const countedQty = Math.max(0, Number(line?.countedQty || 0));
      const currentQty = Number(stockMap.get(`${line?.variation}`) || 0);
      const delta = countedQty - currentQty;
      if (delta === 0) continue;

      await applyStockTransaction({
        shop: req.shopId,
        product: line.product,
        model: line.model,
        variation: line.variation,
        sku: line.sku,
        type: "ADJUSTMENT",
        quantity: delta,
        referenceType: "MANUAL",
        referenceId: reconciliation._id,
        note:
          `${line?.note || ""}`.trim() ||
          `Stock reconciliation ${reconciliation.monthKey} (${currentQty} -> ${countedQty})`,
        createdBy: req.user?._id,
      });
    }

    reconciliation.status = "APPROVED";
    reconciliation.approvedAt = new Date();
    reconciliation.approvedBy = req.user?._id;
    reconciliation.summary = buildSummary(reconciliation.lines || []);
    await reconciliation.save();

    return res.status(200).json({
      success: true,
      message: "Reconciliation approved and stock adjusted",
      data: reconciliation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error approving reconciliation",
      error: "Internal server error",
    });
  }
};
