const express = require('express');
const distributorController = require('../controllers/distributorController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.get('/', distributorController.allDistributors);
router.post('/', distributorController.addDistributor);
router.get('/:id', distributorController.getDistributorDetails);
router.put('/:id', distributorController.updateDistributor);
router.delete('/:id', distributorController.deleteDistributor);

module.exports = router;
