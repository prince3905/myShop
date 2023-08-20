const express = require("express");

const authController =require('../controllers/authController')
const stockController =require('../controllers/stockController')




const router = express.Router();
router.use(authController.protect)


router.get('/', stockController.getStockReport);
// router.get('/:itemId', stockController.getStockQuantity);



module.exports = router;