const express = require("express");

const categoryController =require('../controllers/categoryController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/category-suggestions', categoryController.searchCategoryNameSuggestions);
router.get('/', categoryController.allCategory);
router.post('/', categoryController.addCategory);
// router.put('/', categoryController.updateCategory);
router.put('/', categoryController.updateOrCreateCategory);
router.delete('/:id', categoryController.deleteCategory);
router.get('/:categoryId/brands', categoryController.getBrandsByCategory);



module.exports = router;