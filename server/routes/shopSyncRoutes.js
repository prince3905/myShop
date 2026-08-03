const express = require("express");
const router = express.Router();
const shopSync = require("../controllers/shopSyncController");
const auth = require("../middleware/authMiddleware");

// Require JWT protect
router.use(auth.protect);

// Bulk Clone Shop Data (SUPER_ADMIN and ADMIN)
router.post(
  "/clone-bulk",
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN"),
  shopSync.cloneShopData
);

// Copy single distributor to another shop
router.post(
  "/copy-distributor",
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN"),
  shopSync.copySingleDistributor
);

// Copy single product to another shop
router.post(
  "/copy-product",
  auth.authorizeRoles("SUPER_ADMIN", "ADMIN"),
  shopSync.copySingleProduct
);

module.exports = router;
