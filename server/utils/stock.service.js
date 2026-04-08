const Stock = require("../models/Stock");
const ProductVariation = require("../models/ProductVariation");
const StockTransaction = require("../models/StockTransaction");

const getDelta = (type, quantity) => {
  switch (type) {
    case "IN":
    case "RELEASE":
      return Math.abs(quantity);
    case "OUT":
    case "RESERVE":
      return -Math.abs(quantity);
    case "ADJUSTMENT":
      return Number(quantity);
    default:
      throw new Error("Invalid stock transaction type");
  }
};

exports.applyStockTransaction = async ({
  shop,
  product,
  model,
  variation,
  sku,
  type,
  quantity,
  referenceType = "MANUAL",
  referenceId = null,
  note = "",
  createdBy = null,
}) => {
  const delta = getDelta(type, Number(quantity || 0));
  const absQty = Math.abs(Number(quantity || 0));

  let stock = await Stock.findOne({ shop, variation });
  if (!stock) {
    stock = await Stock.create({
      shop,
      product,
      model,
      variation,
      sku,
      quantity: 0,
    });
  }

  const previousQuantity = Number(stock.quantity || 0);
  const nextQuantity = previousQuantity + delta;

  if (nextQuantity < 0) {
    throw new Error("Insufficient stock for this transaction");
  }

  // ATOMIC UPDATE: Prevent race condition for OUT/RESERVE operations
  // Uses findOneAndUpdate with $inc to ensure concurrent sales don't corrupt stock
  const isDeductOperation = type === "OUT" || type === "RESERVE";
  
  if (isDeductOperation) {
    // Atomic deduct: only succeed if sufficient stock exists
    const updatedStock = await Stock.findOneAndUpdate(
      { shop, variation, quantity: { $gte: absQty } },
      { 
        $inc: { quantity: delta },
        $set: { product, model, sku }
      },
      { new: true }
    );

    if (!updatedStock) {
      throw new Error("Insufficient stock for this transaction");
    }

    await ProductVariation.findByIdAndUpdate(variation, { 
      quantity: updatedStock.quantity 
    });

    const tx = await StockTransaction.create({
      shop,
      product,
      model,
      variation,
      sku,
      type,
      quantity: absQty,
      deltaQuantity: delta,
      previousQuantity,
      newQuantity: updatedStock.quantity,
      referenceType,
      referenceId,
      note,
      createdBy,
    });

    return { stock: updatedStock, tx };
  }

  // For IN/RELEASE/ADJUSTMENT: Safe to use regular save (stock is increasing)
  stock.product = product;
  stock.model = model;
  stock.sku = sku;
  stock.quantity = nextQuantity;
  await stock.save();

  await ProductVariation.findByIdAndUpdate(variation, { quantity: nextQuantity });

  const tx = await StockTransaction.create({
    shop,
    product,
    model,
    variation,
    sku,
    type,
    quantity: absQty,
    deltaQuantity: delta,
    previousQuantity,
    newQuantity: nextQuantity,
    referenceType,
    referenceId,
    note,
    createdBy,
  });

  return { stock, tx };
};
