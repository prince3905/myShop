const express = require("express");

const customerController = require('../controllers/customerController');
const authController = require('../controllers/authController');

const router = express.Router();
router.use(authController.protect);

router.get('/', customerController.getAllCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
