const express = require('express');
const distributorController = require('../controllers/distributorController');
const { protect, attachShop } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(attachShop);

router.get('/distributor-suggestions', distributorController.distributorSuggestions)
router.get('/', distributorController.allDistributors);
router.post('/', distributorController.addDistributor);
router.get('/:id', distributorController.getDistributorDetails);
router.put('/:id', distributorController.updateDistributor);
router.delete('/:id', distributorController.deleteDistributor);
router.patch('/:id/status', distributorController.updateStatus);

module.exports = router;
