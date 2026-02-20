const express = require("express");

const itemController =require('../controllers/ProductController')
const authController =require('../controllers/authController')

const router = express.Router();
module.exports = authController.protect

router.get('/item-suggestions', itemController.searchItemNameSuggestions);
router.get('/size-suggestions', itemController.sizeSuggestions);
router.get('/model-suggestions', itemController.modelSuggestions);
router.get('/by-product-name', itemController.findByProductName);
router.get('/', itemController.allItem);
router.post('/', itemController.addItem);
router.get('/:id', itemController.itemDetails);
router.put('/', itemController.updateItem)
router.delete('/:id', itemController.deleteItem);




module.exports = router;