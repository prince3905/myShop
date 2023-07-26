const express = require("express");

const brandController =require('../controllers/brandController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/', brandController.allBrand);
// router.post('/', itemController.addItem);
// // router.delete('/', userController.deleteUser);
// // router.put('/', userController.updateUser);



module.exports = router;