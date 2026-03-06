const express = require("express");
const customerController = require("../controllers/customerController");
const { protect, attachShop, authorizePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get("/", customerController.getAllCustomers);
router.post("/", authorizePermission("MANAGE_CUSTOMERS"), customerController.createCustomer);
router.get("/:id", customerController.getCustomerById);
router.put("/:id", authorizePermission("MANAGE_CUSTOMERS"), customerController.updateCustomer);
router.delete("/:id", authorizePermission("MANAGE_CUSTOMERS"), customerController.deleteCustomer);
router.patch("/:id/restore", authorizePermission("MANAGE_CUSTOMERS"), customerController.restoreCustomer);

module.exports = router;
