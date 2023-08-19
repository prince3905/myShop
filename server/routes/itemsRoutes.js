const express = require("express");

const itemController =require('../controllers/itemController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/item-suggestions', itemController.searchItemNameSuggestions);
router.get('/size-suggestions', itemController.sizeSuggestions);
router.get('/model-suggestions', itemController.modelSuggestions);
router.get('/', itemController.allItem);
router.post('/', itemController.addItem);
router.get('/:id', itemController.itemDetails);
router.put('/', itemController.updateItem)
router.delete('/:id', itemController.deleteItem);




module.exports = router;