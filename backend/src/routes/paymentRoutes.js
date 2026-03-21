const express = require("express");
const {
  flutterwaveCallback,
  flutterwaveWebhook,
  stripeWebhook,
} = require("../controllers/paymentController");

const router = express.Router();

router.get("/flutterwave/callback", flutterwaveCallback);
router.post("/flutterwave/webhook", express.raw({ type: "application/json" }), flutterwaveWebhook);
router.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhook);

module.exports = router;
