const express = require("express");
const router = express.Router();
const ledgerController = require("../controllers/distributorLedgerController");
const { protect, attachShop, requireShopSelectionForWrite, authorizeRoles } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.post("/", ledgerController.createLedger);
router.get("/:distributorId", ledgerController.getDistributorLedger);

// Admin-only modification routes with anti-fraud audit tracking
router.put("/:id", authorizeRoles("ADMIN", "SUPER_ADMIN"), ledgerController.updateLedger);
router.delete("/:id", authorizeRoles("ADMIN", "SUPER_ADMIN"), ledgerController.deleteLedger);

module.exports = router;
