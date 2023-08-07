const express = require("express");

const categoryController =require('../controllers/categoryController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/', categoryController.allCategory);
router.post('/', categoryController.addCategory);
router.put('/', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);



module.exports = router;