const Customer = require("../models/customerModel");

exports.getAllCustomers = async (req, res) => {
    const { name ,page, perPage} = req.query;
    const query = {};
  try {
     if (name && name !== "null") {
      query.name = { $regex: name, $options: "i" };
    }
    const itemsPerPage = parseInt(perPage) || 10; 
    const currentPage = parseInt(page) || 1; 
    const totalItems = await Customer.countDocuments(query);
    const skipItems = (currentPage - 1) * itemsPerPage;

     const items = await Customer.find(query)
    .skip(skipItems)
    .limit(itemsPerPage);
    const customers = await Customer.find();
    res.status(200).json({customers,totalItems: totalItems});
  } catch (err) {
    console.error("Error retrieving customers:", err);
    res.status(500).json({ error: "Error retrieving customers" });
  }
};

exports.createCustomer = async (req, res) => {
  const newCustomerData = req.body;
  createdAt = new Date();
  const newCustomer = new Customer(newCustomerData);
  try {
    const savedCustomer = await newCustomer.save();
    res.status(201).json({
      message: "Customer added successfully.",
      customer: savedCustomer,
    });
  } catch (err) {
    console.error("Error saving customer:", err);
    res.status(500).json({ error: "Error saving customer" });
  }
};

exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json(customer);
  } catch (err) {
    console.error("Error retrieving customer details:", err);
    res.status(500).json({ error: "Error retrieving customer details" });
  }
};

exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const updatedCustomerData = req.body;
  try {
    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      updatedCustomerData,
      { new: true }
    );
    if (!updatedCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json({
      message: "Customer updated successfully",
      customer: updatedCustomer,
    });
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ error: "Error updating customer" });
  }
};

exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCustomer = await Customer.findByIdAndDelete(id);
    if (!deletedCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(200).json({ message: "Customer deleted successfully" });
  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ error: "Error deleting customer" });
  }
};
