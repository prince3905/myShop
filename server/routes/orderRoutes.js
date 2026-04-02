const express = require("express");
const orderController = require("../controllers/orderController");
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeFeature("sales.orders"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.getAllOrders,
);

router.post(
  "/",
  authorizeFeature("sales.orders.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.createOrder,
);

router.put(
  "/:id",
  authorizeFeature("sales.orders.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.updateOrder,
);

router.get(
  "/:id",
  authorizeFeature("sales.orders"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.getOrderById,
);

router.patch(
  "/:id/status",
  authorizeFeature("sales.orders.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.updateOrderStatus,
);

router.post(
  "/:id/collect-payment",
  authorizeFeature("sales.orders.manage"),
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.collectOrderPayment,
);

module.exports = router;
