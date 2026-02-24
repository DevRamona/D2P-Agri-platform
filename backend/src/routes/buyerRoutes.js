const express = require("express");
const {
  createCheckoutSession,
  createOrder,
  getMarketplace,
  getOrderById,
  getOrders,
  getProfile,
  releaseEscrow,
} = require("../controllers/buyerController");
const { authGuard } = require("../middleware/authGuard");
const { roleGuard } = require("../middleware/roleGuard");

const router = express.Router();

router.use(authGuard);
router.use(roleGuard("BUYER"));

router.get("/marketplace", getMarketplace);
router.get("/profile", getProfile);
router.get("/orders", getOrders);
router.post("/orders/:id/checkout-session", createCheckoutSession);
router.post("/orders/:id/release-escrow", releaseEscrow);
router.get("/orders/:id", getOrderById);
router.post("/orders", createOrder);

module.exports = router;
