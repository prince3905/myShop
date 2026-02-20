const express = require("express");
const router = express.Router();
const ledgerController = require("../controllers/distributorLedgerController");
const { protect, attachShop } = require("../middleware/authMiddleware");
router.post("/", protect, attachShop, ledgerController.createLedger);
router.get(
  "/:distributorId",
  protect,
  attachShop,
  ledgerController.getDistributorLedger,
);

module.exports = router;
