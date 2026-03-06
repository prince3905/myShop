const Customer = require("../models/Customer");
const { logEntityAudit } = require("../utils/entityAudit.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

exports.getAllCustomers = async (req, res) => {
  try {
    const { name, page = 1, perPage = 10 } = req.query;
    const query = isSuperAdminGlobal(req)
      ? { isDeleted: { $ne: true } }
      : { shop: req.shopId, isDeleted: { $ne: true } };

    if (name && name !== "null") {
      query.name = { $regex: name, $options: "i" };
    }

    const itemsPerPage = Math.max(1, Number(perPage || 10));
    const currentPage = Math.max(1, Number(page || 1));
    const skipItems = (currentPage - 1) * itemsPerPage;

    const [customers, totalItems] = await Promise.all([
      Customer.find(query).sort({ createdAt: -1 }).skip(skipItems).limit(itemsPerPage),
      Customer.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, customers, totalItems });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error retrieving customers" });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const payload = { ...req.body, shop: req.shopId };
    const customer = await Customer.create(payload);
    await logEntityAudit({
      shop: req.shopId,
      entityType: "CUSTOMER",
      entityId: customer._id,
      action: "CREATE",
      actor: req.user?._id,
      meta: { name: customer.name, phone: customer.phone },
    });
    return res.status(201).json({
      success: true,
      message: "Customer added successfully",
      customer,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error saving customer" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req)
      ? { _id: req.params.id, isDeleted: { $ne: true } }
      : { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } };
    const customer = await Customer.findOne(query);
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }
    return res.status(200).json({ success: true, customer });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error retrieving customer details" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } },
      req.body,
      { new: true, runValidators: true },
    );
    if (!updatedCustomer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }
    await logEntityAudit({
      shop: req.shopId,
      entityType: "CUSTOMER",
      entityId: updatedCustomer._id,
      action: "UPDATE",
      actor: req.user?._id,
      meta: { updatedFields: Object.keys(req.body || {}) },
    });
    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer: updatedCustomer,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error updating customer" });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } },
      {
        isDeleted: true,
        isActive: false,
        archivedAt: new Date(),
        archivedBy: req.user?._id,
      },
      { new: true },
    );
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }
    await logEntityAudit({
      shop: req.shopId,
      entityType: "CUSTOMER",
      entityId: customer._id,
      action: "ARCHIVE",
      actor: req.user?._id,
      meta: { name: customer.name, phone: customer.phone },
    });
    return res.status(200).json({ success: true, message: "Customer archived successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error deleting customer" });
  }
};

exports.restoreCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: true },
      {
        isDeleted: false,
        isActive: true,
        archivedAt: null,
        archivedBy: null,
      },
      { new: true },
    );
    if (!customer) {
      return res.status(404).json({ success: false, error: "Archived customer not found" });
    }
    await logEntityAudit({
      shop: req.shopId,
      entityType: "CUSTOMER",
      entityId: customer._id,
      action: "RESTORE",
      actor: req.user?._id,
      meta: { name: customer.name, phone: customer.phone },
    });
    return res.status(200).json({ success: true, message: "Customer restored successfully", customer });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error restoring customer" });
  }
};
