const express = require("express");

const orderController = require('../controllers/orderController');
const authController = require('../controllers/authController');

const router = express.Router();
router.use(authController.protect);

router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
// router.get('/:id', orderController.getOrderById);
// router.put('/:id', orderController.updateOrder);
// router.delete('/:id', orderController.deleteOrder);

module.exports = router;
