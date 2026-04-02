const express = require("express");
const customerController = require("../controllers/customerController");
const { protect, attachShop, authorizePermission, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeFeature("people.customers"), customerController.getAllCustomers);
router.get("/search", authorizeFeature("people.customers"), customerController.searchCustomers);
router.post("/", authorizeFeature("people.customers"), authorizePermission("MANAGE_CUSTOMERS"), customerController.createCustomer);
router.get("/:id", authorizeFeature("people.customers"), customerController.getCustomerById);
router.get("/:id/sales", authorizeFeature("people.customers"), customerController.getCustomerSales);
router.put("/:id", authorizeFeature("people.customers"), authorizePermission("MANAGE_CUSTOMERS"), customerController.updateCustomer);
router.delete("/:id", authorizeFeature("people.customers"), authorizePermission("MANAGE_CUSTOMERS"), customerController.deleteCustomer);
router.patch("/:id/restore", authorizeFeature("people.customers"), authorizePermission("MANAGE_CUSTOMERS"), customerController.restoreCustomer);

module.exports = router;
