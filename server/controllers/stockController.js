const Item = require("../models/itemModel");
const Purchase = require("../models/purchaseModel");

exports.getStockReport = async (req, res) => {
  try {
    const lowStockThreshold = 5; // Define low stock threshold
    const { name, category, brand } = req.query;
    const query = {};

    // console.log(req.query);

    if (name && name !== "null") {
      query.name = { $regex: name, $options: "i" };
    }
    if (category && category !== "null") {
      query.category = category;
    }
    if (brand && brand !== "null") {
      query.brand = brand;
    }

    const items = await Item.find(query);
    const stockReport = [];

    for (const item of items) {
      const populatedItem = await Item.findById(item._id)
        .populate("brand")
        .populate("category");

      const purchasedQuantity = await Purchase.aggregate([
        { $unwind: "$items" },
        { $match: { "items.itemName": populatedItem.name } },
        { $group: { _id: null, totalQuantity: { $sum: "$items.quantity" } } },
      ]);

      const remainingQuantity =
        populatedItem.quantity -
        (purchasedQuantity.length > 0 ? purchasedQuantity[0].totalQuantity : 0);

      const isLowStock = remainingQuantity <= lowStockThreshold;

      const stockValue = remainingQuantity * populatedItem.p_price; // Calculate stock value

      stockReport.push({
        itemName: populatedItem.name,
        quantity: populatedItem.quantity,
        remainingQuantity,
        p_price: populatedItem.p_price,
        s_price: populatedItem.s_price,
        brand: populatedItem.brand,
        category: populatedItem.category,
        model: populatedItem.model,
        size: populatedItem.size,
        isLowStock,
        stockValue, // Add stock value information
      });
    }
    res.status(200).json(stockReport);
  } catch (error) {
    console.error("Error retrieving stock report:", error);
    res.status(500).json({ error: "Error retrieving stock report" });
  }
};
