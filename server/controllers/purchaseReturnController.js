const Purchase = require("../models/Purchase");
const PurchaseReturn = require("../models/PurchaseReturn");
const { applyStockTransaction } = require("../utils/stock.service");
const { createDistributorLedgerEntry } = require("../utils/distributorLedger.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const sumReturnedByVariation = async ({ shopId, purchaseId }) => {
  const rows = await PurchaseReturn.aggregate([
    { $match: { shop: shopId, purchase: purchaseId, status: "APPROVED" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.variation",
        qty: { $sum: "$items.quantity" },
      },
    },
  ]);

  const result = new Map();
  rows.forEach((r) => {
    result.set(`${r._id}`, Number(r.qty || 0));
  });
  return result;
};

exports.createPurchaseReturn = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      shop: req.shopId,
      status: "CONFIRMED",
    });
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Confirmed purchase not found",
      });
    }

    const payloadItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!payloadItems.length) {
      return res.status(400).json({
        success: false,
        message: "Return items are required",
      });
    }

    const purchaseItemMap = new Map();
    purchase.items.forEach((it) => {
      purchaseItemMap.set(`${it.variation}`, it);
    });

    const returnedMap = await sumReturnedByVariation({
      shopId: req.shopId,
      purchaseId: purchase._id,
    });

    const hasRemaining = purchase.items.some((it) => {
      const variationId = `${it?.variation || ""}`;
      const purchasedQty = Number(it?.quantity || 0);
      const alreadyReturned = Number(returnedMap.get(variationId) || 0);
      return purchasedQty - alreadyReturned > 0;
    });
    if (!hasRemaining) {
      return res.status(409).json({
        success: false,
        message: "All quantities for this purchase are already returned",
      });
    }

    const returnItems = [];
    for (const item of payloadItems) {
      const variationId = `${item?.variation || ""}`.trim();
      const returnQty = Number(item?.quantity || 0);
      if (!variationId || returnQty <= 0) {
        return res.status(400).json({
          success: false,
          message: "Each return item must have valid variation and quantity",
        });
      }

      const original = purchaseItemMap.get(variationId);
      if (!original) {
        return res.status(400).json({
          success: false,
          message: "Invalid variation for this purchase",
        });
      }

      const purchasedQty = Number(original.quantity || 0);
      const alreadyReturnedQty = Number(returnedMap.get(variationId) || 0);
      const allowedQty = Math.max(0, purchasedQty - alreadyReturnedQty);
      if (returnQty > allowedQty) {
        return res.status(400).json({
          success: false,
          message: `Return qty exceeds limit for SKU ${original.sku}. Purchased: ${purchasedQty}, Already Returned: ${alreadyReturnedQty}, Remaining: ${allowedQty}`,
        });
      }

      const purchasePrice = Number(original.purchasePrice || 0);
      const totalAmount = Number((returnQty * purchasePrice).toFixed(2));
      returnItems.push({
        product: original.product,
        model: original.model,
        variation: original.variation,
        sku: original.sku,
        quantity: returnQty,
        purchasePrice,
        totalAmount,
        reason: item?.reason || "OTHER",
        note: item?.note || "",
      });
    }

    const totalQuantity = returnItems.reduce((acc, it) => acc + Number(it.quantity || 0), 0);
    const totalAmount = Number(
      returnItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0).toFixed(2),
    );

    const purchaseReturn = await PurchaseReturn.create({
      shop: req.shopId,
      purchase: purchase._id,
      distributor: purchase.distributor,
      items: returnItems,
      totalQuantity,
      totalAmount,
      note: req.body?.note || "",
      status: "APPROVED",
      createdBy: req.user?._id,
    });

    for (const item of returnItems) {
      await applyStockTransaction({
        shop: req.shopId,
        product: item.product,
        model: item.model,
        variation: item.variation,
        sku: item.sku,
        type: "OUT",
        quantity: Number(item.quantity || 0),
        referenceType: "RETURN",
        referenceId: purchaseReturn._id,
        note: `Purchase return ${purchase.invoiceNo || purchase._id}`,
        createdBy: req.user?._id,
      });
    }

    if (totalAmount > 0) {
      await createDistributorLedgerEntry({
        shop: req.shopId,
        distributor: purchase.distributor,
        type: "purchase_return",
        amount: totalAmount,
        referenceId: purchaseReturn._id,
        note: `Purchase return ${purchase.invoiceNo || purchase._id}`,
        createdBy: req.user?._id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Purchase return created",
      data: purchaseReturn,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating purchase return",
      error: error.message,
    });
  }
};

exports.listPurchaseReturns = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req)
      ? { purchase: req.params.id }
      : { shop: req.shopId, purchase: req.params.id };

    const rows = await PurchaseReturn.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "email role");

    const totalReturnedQty = rows.reduce((acc, r) => acc + Number(r.totalQuantity || 0), 0);
    const totalReturnedAmount = Number(
      rows.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0).toFixed(2),
    );

    return res.status(200).json({
      success: true,
      data: rows,
      summary: {
        count: rows.length,
        totalReturnedQty,
        totalReturnedAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error listing purchase returns",
      error: error.message,
    });
  }
};
