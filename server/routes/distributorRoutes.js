const express = require('express');
const distributorController = require('../controllers/distributorController');
const { protect, attachShop, authorizeRoles, requireShopSelectionForWrite } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);
router.use(requireShopSelectionForWrite);

router.get('/distributor-suggestions', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.distributorSuggestions)
router.get('/', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.allDistributors);
router.post('/', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.addDistributor);
router.get('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.getDistributorDetails);
router.put('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.updateDistributor);
router.delete('/:id', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.deleteDistributor);
router.patch('/:id/status', authorizeRoles("SUPER_ADMIN", "ADMIN"), distributorController.updateStatus);

module.exports = router;
