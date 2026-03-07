const express = require("express");
const orderController = require("../controllers/orderController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.getAllOrders,
);

router.post(
  "/",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  orderController.createOrder,
);

router.get(
  "/:id",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  orderController.getOrderById,
);

router.patch(
  "/:id/status",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  orderController.updateOrderStatus,
);

router.post(
  "/:id/collect-payment",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"),
  orderController.collectOrderPayment,
);

module.exports = router;
