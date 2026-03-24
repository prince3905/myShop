const express = require("express");
const router = express.Router();
const factoryProductController = require("../controllers/factoryProductController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), factoryProductController.getFactoryProductSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), factoryProductController.getFactoryProducts);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), factoryProductController.createFactoryProduct);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), factoryProductController.updateFactoryProduct);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), factoryProductController.deleteFactoryProduct);

module.exports = router;
