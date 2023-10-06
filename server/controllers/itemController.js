const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Item = require("../models/itemModel");
const Distributor = require('../models/distributorModel');
const Category = require("../models/categoryModel");
const Brand = require("../models/brandModel");

exports.allItem = async (req, res) => {
  try {
    const { name, category, brand, startDate, endDate, page, perPage } =
      req.query;
    const query = {};
    console.log("query",req.query);
    let startOfDay = null,
      endOfDay = null;
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
    }

    const itemsPerPage = parseInt(perPage) || 10; 
    const currentPage = parseInt(page) || 1; 
    const totalItems = await Item.countDocuments(query);
    const skipItems = (currentPage - 1) * itemsPerPage;

    const items = await Item.find(query)
      .populate("category")
      .populate("brand")
      .skip(skipItems)
      .limit(itemsPerPage);
    res.status(200).json({ items, totalItems: totalItems });
    console.log("Count Items:", totalItems);
    console.log("Items:", items);
  } catch (err) {
    console.error("Error retrieving items:", err);
    res.status(500).json({ error: "Error retrieving items" });
  }
};

// working code==========>

// exports.addItem = async (req, res) => {
//   const newItemData = req.body;
//   newItemData.createdAt = new Date();
//   const newItem = new Item(newItemData);
//   newItem
//     .save()
//     .then((savedItem) => {
//       res.status(201).json({
//         message: "Item added successfully.",
//         item: savedItem,
//       });
//     })
//     .catch((err) => {
//       console.error("Error saving item:", err);
//       res.status(500).json({ error: "Error saving item" });
//     });
// };

// =====>

// testCode ========>
exports.addItem = async (req, res) => {
  const newItemData = req.body;
  newItemData.createdAt = new Date();

  const distributorId = newItemData.distributor;
  const itemName = newItemData.name;

  try {
    let existingItem = await Item.findOne({ distributor: distributorId, name: itemName });

    if (existingItem) {
      newItemData.models.forEach(newModel => {
        const existingModel = existingItem.models.find(model => model.model === newModel.model);

        if (existingModel) {
          // Generate a unique order number for each variation
          newModel.variations.forEach(variation => {
            variation.orderNumber = generateOrderNumber();
            variation.soldOut = false;
          });

          existingModel.variations.push(...newModel.variations);
        } else {
          existingItem.models.push(newModel);
        }
      });

      const savedExistingItem = await existingItem.save();
      res.status(201).json({
        message: 'Variation added to existing item successfully.',
        item: savedExistingItem,
      });
    } else {
      // Check if the distributor already exists for the new item
      const existingDistributor = await Distributor.findById(distributorId);

      if (existingDistributor) {
        // If the distributor exists, create a new item associated with the distributor
        newItemData.models.forEach(newModel => {
          // Generate a unique order number for each variation
          newModel.variations.forEach(variation => {
            variation.orderNumber = generateOrderNumber();
            variation.soldOut = false;
          });
        });

        const newItem = new Item(newItemData);
        newItem.models = newItemData.models;
        const savedNewItem = await newItem.save();

        existingDistributor.items.push(savedNewItem._id);
        await existingDistributor.save();

        res.status(201).json({
          message: 'Item added successfully.',
          item: savedNewItem,
        });
      } else {
        // If the distributor doesn't exist, create a new distributor and associate the item
        const newDistributor = new Distributor({
          _id: distributorId,
          items: [newItemData.models[0]._id], // Assuming each variation is unique
        });
        await newDistributor.save();

        newItemData.models.forEach(newModel => {
          // Generate a unique order number for each variation
          newModel.variations.forEach(variation => {
            variation.orderNumber = generateOrderNumber();
            variation.soldOut = false;
          });
        });

        const newItem = new Item(newItemData);
        newItem.models = newItemData.models;
        const savedNewItem = await newItem.save();

        res.status(201).json({
          message: 'Item and Distributor added successfully.',
          item: savedNewItem,
        });
      }
    }
  } catch (err) {
    console.error('Error saving item:', err);
    res.status(500).json({ error: 'Error saving item' });
  }
};



// Function to generate the order number
function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const randomDigits = Math.floor(Math.random() * 10000);

  return `${year}${month}${day}${randomDigits}`;
}


// =======>
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

exports.sizeSuggestions = async (req, res) => {
  try {
    console.log(req.query);
    const searchTerm = req.query.term;
    const suggestions = await Item.find({
      size: { $regex: searchTerm, $options: "i" },
    }).limit(10);
    res.status(200).json(suggestions.map((item) => item.size));
    console.log(suggestions.map((item) => item.size));
  } catch (err) {
    console.error("Error searching size suggestions:", err);
    res.status(500).json({ error: "Error searching size suggestions" });
  }
};

exports.modelSuggestions = async (req, res) => {
  try {
    console.log(req.query);
    const searchTerm = req.query.term;
    const suggestions = await Item.find({
      model: { $regex: searchTerm, $options: "i" },
    }).limit(10);
    res.status(200).json(suggestions.map((item) => item.model));
    console.log(suggestions.map((item) => item.model));
  } catch (err) {
    console.error("Error searching model suggestions:", err);
    res.status(500).json({ error: "Error searching model suggestions" });
  }
};
