const express = require("express");
const { register, login, refresh, me, logout } = require("../controllers/authController");
const { authGuard } = require("../middleware/authGuard");
const { roleGuard } = require("../middleware/roleGuard");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authGuard, roleGuard("FARMER", "BUYER", "ADMIN"), me);
router.post("/logout", logout);

module.exports = router;
