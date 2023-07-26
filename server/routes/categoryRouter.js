const express = require("express");

const categoryController =require('../controllers/categoryController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/', categoryController.allCategory);
// router.post('/', itemController.addItem);
// // router.delete('/', userController.deleteUser);
// // router.put('/', userController.updateUser);



module.exports = router;