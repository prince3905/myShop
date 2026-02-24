const Brand = require("../models/brand");

/* =========================
   CREATE BRAND
========================= */
exports.createBrand = async (req, res) => {
  try {
    const { name, description, logo, shop } = req.body;

    const brand = await Brand.create({
      name,
      description,
      logo,
      shop
    });

    res.status(201).json({
      success: true,
      message: "Brand created successfully",
      data: brand
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists for this shop"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating brand",
      error: error.message
    });
  }
};


/* =========================
   GET ALL BRANDS (SHOP WISE)
========================= */
exports.getBrands = async (req, res) => {
  try {
    const { shop } = req.query;

    const brands = await Brand.find({ shop });

    res.status(200).json({
      success: true,
      count: brands.length,
      data: brands
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching brands"
    });
  }
};


/* =========================
   UPDATE BRAND
========================= */
exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Brand updated successfully",
      data: brand
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating brand"
    });
  }
};


/* =========================
   DELETE BRAND
========================= */
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findByIdAndDelete(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Brand deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting brand"
    });
  }
};