const express = require("express");
const customerController = require("../controllers/customerController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeFeature("people.customers"), customerController.getAllCustomers);
router.get("/search", authorizeFeature("people.customers"), customerController.searchCustomers);
router.post("/", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.createCustomer);
router.get("/:id", authorizeFeature("people.customers"), customerController.getCustomerById);
router.get("/:id/sales", authorizeFeature("people.customers"), customerController.getCustomerSales);
router.put("/:id", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.updateCustomer);
router.delete("/:id", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.deleteCustomer);
router.patch("/:id/restore", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.restoreCustomer);

module.exports = router;
