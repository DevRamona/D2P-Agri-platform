const express = require("express");
const { getDashboard, getInventory, addProduct, createBatch } = require("../controllers/farmerController");
const { authGuard } = require("../middleware/authGuard");
const { roleGuard } = require("../middleware/roleGuard");

const router = express.Router();

// Apply guards to all routes if appropriate, or individually
router.use(authGuard);
router.use(roleGuard("FARMER"));

const upload = require("../middleware/upload");

router.get("/dashboard", getDashboard);
router.get("/inventory", getInventory);
router.post("/inventory", upload.single("image"), addProduct);
router.post("/batch", createBatch);

module.exports = router;
