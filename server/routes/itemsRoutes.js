const express = require("express");

const itemController =require('../controllers/itemController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/', itemController.allItem);
router.post('/', itemController.addItem);
router.get('/:id', itemController.itemDetails);
router.put('/', itemController.updateItem)
router.delete('/:id', itemController.deleteItem);



module.exports = router;