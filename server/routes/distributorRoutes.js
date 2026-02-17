const express = require('express');
const distributorController = require('../controllers/distributorController');
const authController = require('../controllers/authController');

const router = express.Router();

module.exports = authController.protect;

router.get('/distributor-suggestions', distributorController.distributorSuggestions)
router.get('/', distributorController.allDistributors);
router.post('/', distributorController.addDistributor);
router.get('/:id', distributorController.getDistributorDetails);
router.put('/:id', distributorController.updateDistributor);
router.delete('/:id', distributorController.deleteDistributor);
router.patch('/:id/status', distributorController.updateStatus);

module.exports = router;
