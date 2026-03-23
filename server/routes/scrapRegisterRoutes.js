const express = require("express");
const router = express.Router();
const scrapRegisterController = require("../controllers/scrapRegisterController");
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get("/summary", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), scrapRegisterController.getScrapSummary);
router.get("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), scrapRegisterController.getScraps);
router.post("/", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), scrapRegisterController.createScrap);
router.put("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), scrapRegisterController.updateScrap);
router.delete("/:id", authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER"), scrapRegisterController.deleteScrap);

module.exports = router;
