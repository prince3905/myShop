const logger = require("../utils/logger");
const Customer = require("../models/Customer");
const EntityAuditLog = require("../models/EntityAuditLog");
const { logEntityAudit } = require("../utils/entityAudit.service");
const {
  buildCustomerLedger,
  buildCustomerPayload,
  getCustomerDuplicateMessage,
} = require("../utils/customerAccount.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const TRACKED_CUSTOMER_FIELDS = ["name", "phone", "email", "address"];

const getCustomerFieldChanges = (beforeDoc = {}, afterDoc = {}) => {
  const changes = [];

  TRACKED_CUSTOMER_FIELDS.forEach((field) => {
    const beforeValue = `${beforeDoc?.[field] ?? ""}`.trim();
    const afterValue = `${afterDoc?.[field] ?? ""}`.trim();

    if (beforeValue === afterValue) {
      return;
    }

    changes.push({
      field,
      before: beforeValue || null,
      after: afterValue || null,
    });
  });

  return changes;
};

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
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skipItems)
        .limit(itemsPerPage)
        .select("name phone email address totalPurchase totalPaid totalDue walletBalance purchaseCount createdAt isActive shop")
        .populate("shop", "shopName shopCode"),
      Customer.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, customers, totalItems });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error retrieving customers" });
  }
};

exports.searchCustomers = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const searchTerm = (q || "").trim();
    
    if (!searchTerm) {
      return res.status(200).json({ success: true, customers: [] });
    }

    const query = isSuperAdminGlobal(req)
      ? { isDeleted: { $ne: true } }
      : { shop: req.shopId, isDeleted: { $ne: true } };

    // Clean search term for phone - remove non-digits
    const cleanSearch = searchTerm.replace(/\D/g, '');
    
    // Search by name OR phone number
    // If user entered digits, search in phone as well
    if (cleanSearch.length > 0) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { phone: { $regex: cleanSearch, $options: "i" } }
      ];
    } else {
      // Only search by name if no digits entered
      query.name = { $regex: searchTerm, $options: "i" };
    }

    const customers = await Customer.find(query)
      .sort({ name: 1 })
      .limit(Math.min(100, Number(limit || 20)))
      .select('_id name phone email address totalPurchase totalPaid totalDue walletBalance purchaseCount creditLimit');

    return res.status(200).json({ success: true, customers });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error searching customers" });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const payload = await buildCustomerPayload({
      shopId: req.shopId,
      body: req.body,
      requirePhone: true,
    });
    const customer = await Customer.create({ ...payload, shop: req.shopId });
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
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    const duplicateMessage = getCustomerDuplicateMessage(err);
    if (duplicateMessage) {
      return res.status(err.statusCode || 409).json({ success: false, message: duplicateMessage });
    }
    return res.status(500).json({ success: false, error: "Error saving customer" });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const query = isSuperAdminGlobal(req)
      ? { _id: req.params.id, isDeleted: { $ne: true } }
      : { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } };
    const customer = await Customer.findOne(query).populate("shop", "shopName shopCode");
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const auditLogs = await EntityAuditLog.find({
      entityType: "CUSTOMER",
      entityId: customer._id,
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate("actor", "name pFname pLname email")
      .lean();

    return res.status(200).json({ success: true, customer, auditLogs });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error retrieving customer details" });
  }
};

exports.getCustomerSales = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, perPage = 10, dateFrom, dateTo } = req.query;
    
    // First check if customer exists
    const customerQuery = isSuperAdminGlobal(req)
      ? { _id: id, isDeleted: { $ne: true } }
      : { _id: id, shop: req.shopId, isDeleted: { $ne: true } };
    
    const customer = await Customer.findOne(customerQuery).lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const ledger = await buildCustomerLedger({
      shopId: customer.shop,
      customerId: customer._id,
      dateFrom,
      dateTo,
      page,
      perPage,
    });

    return res.status(200).json({
      success: true,
      sales: ledger.rows,
      totalItems: ledger.totalItems,
      summary: ledger.summary,
    });
  } catch (err) {
    logger.error("Error getting customer sales:", err);
    return res.status(500).json({ success: false, error: "Error retrieving customer sales" });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const payload = await buildCustomerPayload({
      shopId: req.shopId,
      body: req.body,
      excludeCustomerId: req.params.id,
    });

    const existingCustomer = await Customer.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: { $ne: true },
    }).lean();

    if (!existingCustomer) {
      return res.status(404).json({ success: false, error: "Customer not found" });
    }

    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } },
      payload,
      { new: true, runValidators: true },
    );
    const fieldChanges = getCustomerFieldChanges(existingCustomer, updatedCustomer);

    await logEntityAudit({
      shop: req.shopId,
      entityType: "CUSTOMER",
      entityId: updatedCustomer._id,
      action: "UPDATE",
      actor: req.user?._id,
      meta: {
        updatedFields: Object.keys(payload || {}),
        changes: fieldChanges,
      },
    });
    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer: updatedCustomer,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    const duplicateMessage = getCustomerDuplicateMessage(err);
    if (duplicateMessage) {
      return res.status(err.statusCode || 409).json({ success: false, message: duplicateMessage });
    }
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
