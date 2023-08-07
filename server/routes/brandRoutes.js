const express = require("express");

const brandController =require('../controllers/brandController')
const authController =require('../controllers/authController')

const router = express.Router();
router.use(authController.protect)

router.get('/', brandController.allBrand);
router.post('/', brandController.addBrand);
router.put('/', brandController.updateBrand);
router.delete('/:id', brandController.deleteBrand);



module.exports = router;