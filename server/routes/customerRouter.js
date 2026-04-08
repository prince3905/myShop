const express = require("express");
const customerController = require("../controllers/customerController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");
const { hasFeatureAccess } = require("../utils/featureAccess");
const { customerRateLimit } = require("../middleware/rateLimiter");
const { validateCustomerCreation, validate } = require("../middleware/authValidation");

const router = express.Router();

const authorizeCustomerBasicWrite = async (req, res, next) => {
  const role = req.user?.role;

  if (await hasFeatureAccess(role, "people.customers.manage")) {
    return next();
  }

  if (role === "STAFF" && await hasFeatureAccess(role, "people.customers")) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Feature access denied: people.customers.manage",
  });
};

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/", authorizeFeature("people.customers"), customerController.getAllCustomers);
router.get("/search", authorizeFeature("people.customers"), customerController.searchCustomers);
router.post("/", customerRateLimit, validateCustomerCreation, validate, authorizeCustomerBasicWrite, authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.createCustomer);
router.get("/:id", authorizeFeature("people.customers"), customerController.getCustomerById);
router.get("/:id/sales", authorizeFeature("people.customers"), customerController.getCustomerSales);
router.put("/:id", authorizeCustomerBasicWrite, authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.updateCustomer);
router.delete("/:id", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.deleteCustomer);
router.patch("/:id/restore", authorizeFeature("people.customers.manage"), authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), customerController.restoreCustomer);

module.exports = router;
