const express = require("express");
const router = express.Router();
const factoryProductController = require("../controllers/factoryProductController");
const {
  protect,
  attachShop,
  authorizeRoles,
  authorizeFeature,
  authorizeAnyFeature,
  requireShopSelectionForWrite,
} = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("factory.product_master"), factoryProductController.getFactoryProductSummary);
router.get(
  "/options",
  authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"),
  authorizeAnyFeature("factory.product_master", "staff.daily_work", "factory.verification", "factory.report"),
  factoryProductController.getFactoryProductOptions,
);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("factory.product_master"), factoryProductController.getFactoryProducts);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.product_master"), factoryProductController.createFactoryProduct);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.product_master"), factoryProductController.updateFactoryProduct);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), authorizeFeature("factory.product_master"), factoryProductController.deleteFactoryProduct);

module.exports = router;
