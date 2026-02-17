const express = require("express");

const authController =require('../controllers/authController')
const stockController =require('../controllers/stockController')




const router = express.Router();
module.exports = authController.protect


router.get('/', stockController.getStockReport);
// router.get('/:itemId', stockController.getStockQuantity);



module.exports = router;