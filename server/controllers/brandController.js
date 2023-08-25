const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const Brand = require('../models/brandModel');

exports.addBrand = async (req, res) => {
  const newCBrandData = req.body;
  newCBrandData.createdAt = new Date();
  const newBrand = new Brand(newCBrandData);
  newBrand
    .save()
    .then((savedBrand) => {
      res.status(201).json({
        message: "Brand added successfully.",
        Category: savedBrand,
      });
    })
    .catch((err) => {
      console.error("Error saving brand:", err);
      res.status(500).json({ error: "Error saving brand" });
    });
};



exports.updateBrand = async (req, res) => {
  const brandId = req.body;
  // console.log(brandId);
  try {
    const updatedBrandData = {
      name: req.body.name,
      description: req.body.description,
    };
    const updatedBrand = await Brand.findByIdAndUpdate(
      brandId,
      updatedBrandData,
      {
        new: true,
      }
    );
    if (!updatedBrand) {
      return res.status(404).json({ error: "Brand not found" });
    }
    res.status(200).json({
      message: "Brand updated successfully.",
      category: updatedBrand,
    });
  } catch (error) {
    console.error("Error updating brand:", error);
    res.status(500).json({ error: "Error updating brand" });
  }
};




exports.allBrand = async (req, res) => {
  try {
    const brand = await Brand.find({})
    // console.log(brand);
    res.status(200).json(brand);
  } catch (err) {
    console.error("Error retrieving brand:", err);
    res.status(500).json({ error: "Error retrieving brand" });
  }
};

exports.deleteBrand = (req, res) => {
  const { id } = req.params;
  // console.log(req.params)
  Brand.findByIdAndDelete(id)
    .then((deleteBrand) => {
      if (!deleteBrand) {
        return res.status(404).json({ error: "Brand  not found" });
      }

      // console.log("Brand delete:", deleteBrand);
      res.status(200).json({ message: "Brand deleted successfully" });
    })
    .catch((err) => {
      console.error("Error deleting Brand :", err);
      res.status(500).json({ error: "Error deleting Brand" });
    });
};


