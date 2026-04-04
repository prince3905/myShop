const express = require('express');
const distributorController = require('../controllers/distributorController');
const { protect, attachShop, authorizeRoles, authorizeFeature, authorizeAnyFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get('/distributor-suggestions', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeAnyFeature("people.distributors", "people.distributors.manage", "inventory.purchase.manage", "factory.raw_material_purchase"), distributorController.distributorSuggestions)
router.get('/', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeAnyFeature("people.distributors", "people.distributors.manage", "inventory.purchase.manage", "factory.raw_material_purchase"), distributorController.allDistributors);
router.post('/', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.addDistributor);
router.get('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeAnyFeature("people.distributors", "people.distributors.manage", "inventory.purchase.manage", "factory.raw_material_purchase"), distributorController.getDistributorDetails);
router.put('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.updateDistributor);
router.delete('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.deleteDistributor);
router.patch('/:id/status', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.updateStatus);

module.exports = router;
