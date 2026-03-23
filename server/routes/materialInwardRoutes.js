const express = require("express");
const router = express.Router();
const {
  createMaterialInward,
  getMaterialInwards,
  getMaterialInwardSummary,
  updateMaterialInward,
  deleteMaterialInward,
} = require("../controllers/materialInwardController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/summary", getMaterialInwardSummary);
router.get("/", getMaterialInwards);
router.post("/", createMaterialInward);
router.put("/:id", updateMaterialInward);
router.delete("/:id", deleteMaterialInward);

module.exports = router;
