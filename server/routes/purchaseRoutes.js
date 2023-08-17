const express = require("express");

const purchaseController =require('../controllers/purchaseController')
const authController =require('../controllers/authController')


const router = express.Router();
router.use(authController.protect)

router.get('/', purchaseController.allPurchase);
router.post('/', purchaseController.createPurchase);
// router.get('/:id', itemController.itemDetails);
// router.put('/', itemController.updateItem)
// router.delete('/:id', itemController.deleteItem);



module.exports = router;