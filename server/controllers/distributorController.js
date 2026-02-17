const Distributor = require("../models/distributor");
const Item = require("../models/item");

exports.allDistributors = async (req, res) => {
  try {
    const { name, phone, page = 1, perPage = 10 } = req.query;
    const query = {};
    console.log("Query  ", req.query);

    if (name && name !== "null") {
      query.name = { $regex: name, $options: "i" };
    }
    if (phone && phone !== "null") {
      query.phone = { $regex: phone, $options: "i" };
    }
    // console.log("Query  ", query);

    const itemsPerPage = parseInt(perPage) || 10;
    const currentPage = parseInt(page) || 1;
    const totalItems = await Distributor.countDocuments(query);
    const skipItems = (currentPage - 1) * itemsPerPage;
    const distributors = await Distributor.find(query)
      .skip(skipItems)
      .limit(perPage)
      // .populate("items")
      .sort({ createdAt: -1 });

      // console.log("Distributors  ", distributors);

    res.status(200).json({ distributors, totalItems });
  } catch (err) {
    console.error("Error retrieving distributors:", err);
    res.status(500).json({ error: "Error retrieving distributors" });
  }
};

exports.addDistributor = async (req, res) => {
  try {
    console.log(req.body);
    const newDistributorData = {
      name: req.body.name,
      shopName: req.body.shopName,
      email: req.body.email,
      phone: req.body.phone,
      telephone: req.body.telephone,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      items: req.body.items || [],
      createdAt: new Date(),
    };

    const newDistributor = new Distributor(newDistributorData);
    const savedDistributor = await newDistributor.save();

    res.status(201).json({
      message: "Distributor added successfully.",
      distributor: savedDistributor,
    });
  } catch (err) {
    console.error("Error saving distributor:", err);
    res.status(500).json({ error: "Error saving distributor" });
  }
};

exports.getDistributorDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const distributor = await Distributor.findById(id).populate("products");
    if (!distributor) {
      return res.status(404).json({ error: "Distributor not found" });
    }
    res.status(200).json(distributor);
  } catch (err) {
    console.error("Error retrieving distributor details:", err);
    res.status(500).json({ error: "Error retrieving distributor details" });
  }
};

exports.updateDistributor = async (req, res) => {
  const { id } = req.params;
  const updatedDistributorData = req.body;
  try {
    const updatedDistributor = await Distributor.findByIdAndUpdate(
      id,
      updatedDistributorData,
      { new: true },
    );
    if (!updatedDistributor) {
      return res.status(404).json({ error: "Distributor not found" });
    }
    res.status(200).json({
      message: "Distributor updated successfully",
      distributor: updatedDistributor,
    });
  } catch (err) {
    console.error("Error updating distributor:", err);
    res.status(500).json({ error: "Error updating distributor" });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["active", "disabled", "inactive"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const distributor = await Distributor.findById(id);
    if (!distributor) {
      return res
        .status(404)
        .json({ success: false, message: "Distributor not found" });
    }

    distributor.status = status;
    await distributor.save();

    return res.json({
      success: true,
      message: "Status updated",
      data: { id: distributor._id, status: distributor.status },
    });
  } catch (err) {
    console.error("updateStatus error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteDistributor = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedDistributor = await Distributor.findByIdAndDelete(id);
    if (!deletedDistributor) {
      return res.status(404).json({ error: "Distributor not found" });
    }
    res.status(200).json({ message: "Distributor deleted successfully" });
  } catch (err) {
    console.error("Error deleting distributor:", err);
    res.status(500).json({ error: "Error deleting distributor" });
  }
};

exports.distributorSuggestions = async (req, res) => {
  try {
    console.log(req.query);

    const searchTerm = req.query.term;

    const suggestions = await Distributor.find({
      name: { $regex: searchTerm, $options: "i" },
    }).limit(10);

    res.status(200).json(suggestions.map((distributor) => distributor.name));
  } catch (error) {
    console.error("Error searching distributor suggestions:", error);
    res.status(500).json({ error: "Error searching distributor suggestions" });
  }
};
