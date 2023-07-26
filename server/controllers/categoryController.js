const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Category = require('../models/categoryModel');



exports.allCategory = async (req, res) => {
  try {
    const category = await Category.find({})
    console.log(category);
    res.status(200).json(category);
  } catch (err) {
    console.error("Error retrieving category:", err);
    res.status(500).json({ error: "Error retrieving category" });
  }
};

// exports.addItem = async (req, res) => {
//   const newItemData = {
//     name: "Classic White",
//     category: "64bd2640dc8317a0c5d0f970", 
//     brand: "64bd038bdc8317a0c5d0f953", 
//     p_price: 30.99,
//     s_price: 40.99, 
//     quantity: 100,
//     model: "ABC123", 
//     color: "White", 
//     size: "M",
//     description: "A classic white T-shirt made from high-quality cotton.",
//   };
//   const newItem = new Item(newItemData);
//   newItem
//     .save()
//     .then((savedItem) => {
//       res.status(201).json(savedItem);
//     })
//     .catch((err) => {
//       console.error("Error saving item:", err);
//       res.status(500).json({ error: "Error saving item" });
//     });
// };