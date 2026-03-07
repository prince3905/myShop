const express = require("express");
const router = express.Router();
const ledgerController = require("../controllers/distributorLedgerController");
const { protect, attachShop, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.post("/", ledgerController.createLedger);
router.get("/:distributorId", ledgerController.getDistributorLedger);

module.exports = router;
