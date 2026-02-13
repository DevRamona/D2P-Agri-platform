const express = require("express");
const { getDashboard } = require("../controllers/farmerController");
const { authGuard } = require("../middleware/authGuard");
const { roleGuard } = require("../middleware/roleGuard");

const router = express.Router();

router.get("/dashboard", authGuard, roleGuard(["FARMER"]), getDashboard);

module.exports = router;
