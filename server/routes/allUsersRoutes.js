const express = require("express");
const router = express.Router();

const userController = require('../controllers/userController')

// router.use('/', (req, res) => {
//   res.status(200).send("hello world !").userController;
// });
router.get('/', userController.allUser);
router.get('/:id', userController.userDetails);
router.post('/', userController.createUser);
router.delete('/', userController.deleteUser);
router.put('/', userController.updateUser);



module.exports = router;
