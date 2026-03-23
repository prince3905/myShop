const express = require("express");
const router = express.Router();
const factoryProductionController = require("../controllers/factoryProductionController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), factoryProductionController.getProductionSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), factoryProductionController.getProductions);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), factoryProductionController.createProduction);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), factoryProductionController.updateProduction);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), factoryProductionController.deleteProduction);

module.exports = router;
