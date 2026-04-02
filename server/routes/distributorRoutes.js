const express = require('express');
const distributorController = require('../controllers/distributorController');
const { protect, attachShop, authorizeRoles, authorizeFeature, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get('/distributor-suggestions', authorizeRoles("SUPER_ADMIN", "ADMIN"), authorizeFeature("people.distributors"), distributorController.distributorSuggestions)
router.get('/', authorizeRoles("SUPER_ADMIN", "ADMIN"), authorizeFeature("people.distributors"), distributorController.allDistributors);
router.post('/', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.addDistributor);
router.get('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN"), authorizeFeature("people.distributors"), distributorController.getDistributorDetails);
router.put('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.updateDistributor);
router.delete('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.deleteDistributor);
router.patch('/:id/status', authorizeRoles("SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"), authorizeFeature("people.distributors.manage"), distributorController.updateStatus);

module.exports = router;
