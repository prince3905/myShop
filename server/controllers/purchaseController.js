const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Purchase = require("../models/purchaseModel");

exports.allPurchase = async (req, res) => {
  try {
    console.log(req.body);
    const { customerName, itemName, category, brand, startDate, endDate } =
      req.query;
    const query = {};
    let startOfDay = null,
      endOfDay = null; // Declare the variables here
    console.log(req.query);
    if (customerName && customerName !== "null") {
      query.customerName = { $regex: customerName, $options: "i" };
    }
    if (itemName && itemName !== "null") {
      query.$or = [
        { "items.itemName": { $regex: itemName, $options: "i" } },
        { "items.category": category },
        { "items.brand": brand },
      ];
    }

    if (brand && brand !== "null") {
      if (!query.$or) {
        query.$or = [];
      }
      query.$or.push({ "items.brand": brand });
    }

    if (category && category !== "null") {
      if (!query.$or) {
        query.$or = [];
      }
      query.$or.push({ "items.category": category });
    }
    if (startDate && endDate && startDate !== "null" && endDate !== "null") {
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.purchaseDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };

      console.log(
        "Formatted Start Date:",
        startOfDay.toISOString().split("T")[0]
      );
      console.log("Formatted End Date:", endOfDay.toISOString().split("T")[0]);
    }
    const itemResults = await Purchase.find(query)
      .populate("items.category")
      .populate("items.brand");
    console.log(itemResults);
    res.status(200).json(itemResults);
  } catch (err) {
    console.error("Error retrieving ItemName:", err);
    res.status(500).json({ error: "Error retrieving iItemName" });
  }
};

exports.createPurchase = async (req, res) => {
  try {
    const newPurchaseData = req.body;
    console.log(newPurchaseData);

    // Calculate the total purchase price and total quantity
    const { totalPurchasePrice, totalQuantity } = newPurchaseData.items.reduce(
      (acc, item) => {
        const itemTotalPrice = item.purchasePrice * item.quantity;
        return {
          totalPurchasePrice: acc.totalPurchasePrice + itemTotalPrice,
          totalQuantity: acc.totalQuantity + item.quantity,
        };
      },
      { totalPurchasePrice: 0, totalQuantity: 0 }
    );

    newPurchaseData.totalPurchasePrice = totalPurchasePrice;
    newPurchaseData.totalQuantity = totalQuantity;

    newPurchaseData.purchaseDate = new Date();
    const newPurchase = new Purchase(newPurchaseData);
    const savedPurchase = await newPurchase.save();
    res.status(201).json({
      message: "Purchase added successfully.",
      Purchase: savedPurchase,
    });
  } catch (err) {
    console.error("Error saving Purchase:", err);
    res.status(500).json({ error: "Error saving Purchase" });
  }
};
