const express = require("express");
const customerController = require("../controllers/customerController");
const { protect, attachShop, authorizePermission, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", customerController.getAllCustomers);
router.get("/search", customerController.searchCustomers);
router.post("/", authorizePermission("MANAGE_CUSTOMERS"), customerController.createCustomer);
router.get("/:id", customerController.getCustomerById);
router.get("/:id/sales", customerController.getCustomerSales);
router.put("/:id", authorizePermission("MANAGE_CUSTOMERS"), customerController.updateCustomer);
router.delete("/:id", authorizePermission("MANAGE_CUSTOMERS"), customerController.deleteCustomer);
router.patch("/:id/restore", authorizePermission("MANAGE_CUSTOMERS"), customerController.restoreCustomer);

module.exports = router;
