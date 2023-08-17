const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Item = require("../models/itemModel");
const Category = require("../models/categoryModel");
const Brand = require("../models/brandModel");

exports.allItem = async (req, res) => {
  try {
    const { name, category, brand, startDate, endDate } = req.query;
    const query = {};
    let startOfDay = null, endOfDay = null; // Declare the variables here

    if (name && name !== "null") {
      query.name = { $regex: name, $options: "i" };
    }
    if (category && category !== "null") {
      query.category = category;
    }
    if (brand && brand !== "null") {
      query.brand = brand;
    }

    if (startDate && endDate && startDate !== "null" && endDate !== "null") {
      startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };

      console.log("Formatted Start Date:", startOfDay.toISOString().split('T')[0]);
      console.log("Formatted End Date:", endOfDay.toISOString().split('T')[0]);
    }

    const items = await Item.find(query).populate("category").populate("brand");
    res.status(200).json(items);
  } catch (err) {
    console.error("Error retrieving items:", err);
    res.status(500).json({ error: "Error retrieving items" });
  }
  console.log("Formatted Start Date:", startOfDay.toISOString().split("T")[0]);
  console.log("Formatted End Date:", endOfDay.toISOString().split("T")[0]);
};

exports.addItem = async (req, res) => {
  const newItemData = req.body;
  newItemData.createdAt = new Date();
  const newItem = new Item(newItemData);
  newItem
    .save()
    .then((savedItem) => {
      res.status(201).json({
        message: "Item added successfully.",
        item: savedItem,
      });
    })
    .catch((err) => {
      console.error("Error saving item:", err);
      res.status(500).json({ error: "Error saving item" });
    });
};

exports.itemDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Item.findById(id).populate("category").populate("brand");
    console.log("Found Item:", item);
    res.status(200).json(item);
  } catch (err) {
    console.error("Error retrieving items Details:", err);
    res.status(500).json({ error: "Error retrieving items Details" });
  }
};

exports.updateItem = (req, res) => {
  const {
    id,
    name,
    color,
    model,
    description,
    p_price,
    quantity,
    s_price,
    brand,
    category,
    size,
  } = req.body;
  // Create an object with the updated fields
  const updatedItem = {
    name,
    color,
    model,
    description,
    p_price,
    quantity,
    s_price,
    brand,
    category,
    size,
  };

  Item.findByIdAndUpdate(id, updatedItem, { new: true })
    .then((updatedItem) => {
      if (!updatedItem) {
        return res.status(404).json({ error: "Item not found" });
      }

      console.log("Updated Item:", updatedItem);
      res
        .status(200)
        .json({ message: "Item updated successfully", item: updatedItem });
    })
    .catch((err) => {
      console.error("Error updating item:", err);
      res.status(500).json({ error: "Error updating item" });
    });
};

exports.deleteItem = (req, res) => {
  const { id } = req.params;

  Item.findByIdAndDelete(id)
    .then((DeleteItem) => {
      if (!DeleteItem) {
        return res.status(404).json({ error: "Item not found" });
      }

      console.log("Item delete:", DeleteItem);
      res.status(200).json({ message: "Item deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting item:", err);
      res.status(500).json({ error: "Error deleting item" });
    });
};

exports.searchItemNameSuggestions = async (req, res) => {
  try {
    console.log(req.query);
    const searchTerm = req.query.term;
    const suggestions = await Item.find({
      name: { $regex: searchTerm, $options: "i" },
    }).limit(10);
    res.status(200).json(suggestions.map((item) => item.name));
    console.log(suggestions.map((item) => item.name));
  } catch (err) {
    console.error("Error searching item name suggestions:", err);
    res.status(500).json({ error: "Error searching item name suggestions" });
  }
};
