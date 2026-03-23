const express = require("express");
const router = express.Router();
const finishedGoodsRegisterController = require("../controllers/finishedGoodsRegisterController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), finishedGoodsRegisterController.getFinishedGoodsSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), finishedGoodsRegisterController.getFinishedGoods);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), finishedGoodsRegisterController.createFinishedGoods);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), finishedGoodsRegisterController.updateFinishedGoods);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), finishedGoodsRegisterController.deleteFinishedGoods);

module.exports = router;
