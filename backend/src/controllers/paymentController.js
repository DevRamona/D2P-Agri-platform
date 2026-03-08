const BuyerOrder = require("../models/BuyerOrder");
const {
  getStripeClient,
  getStripeWebhookSecret,
  isStripeEnabled,
} = require("../services/stripeService");

const _parseRawJsonBody = (buffer) => {
  if (!buffer) return {};
  const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
  return JSON.parse(text);
};

const _resolveOrderIdFromEvent = (event) => {
  const object = event?.data?.object || {};
  if (object.metadata?.orderId) return String(object.metadata.orderId);

  if (typeof object.payment_intent === "object" && object.payment_intent?.metadata?.orderId) {
    return String(object.payment_intent.metadata.orderId);
  }

  return null;
};

const _handleCheckoutCompleted = async (session) => {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;

  const now = new Date();
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && typeof session.payment_intent === "object"
        ? session.payment_intent.id
        : null;

  const update = {
    stripeCheckoutSessionId: session.id || null,
    stripePaymentIntentId: paymentIntentId,
    stripePaymentStatus: session.payment_status || null,
  };

  if (session.payment_status === "paid") {
    update.paymentStatus = "deposit_paid";
    update.escrowStatus = "funded";
    update.paymentConfirmedAt = now;
    update.escrowFundedAt = now;
    update.trackingStage = "payment_confirmed";
    update.trackingUpdatedAt = now;
  }

  await BuyerOrder.findByIdAndUpdate(orderId, { $set: update });
};

const _handleCheckoutExpired = async (session) => {
  const orderId = session?.metadata?.orderId;
  if (!orderId) return;

  await BuyerOrder.findByIdAndUpdate(orderId, {
    $set: {
      stripeCheckoutSessionId: session.id || null,
      stripePaymentStatus: "expired",
      paymentStatus: "failed",
      escrowStatus: "awaiting_payment",
      trackingStage: "awaiting_payment",
      trackingUpdatedAt: new Date(),
    },
  });
};

const _handlePaymentIntentSucceeded = async (paymentIntent) => {
  const orderId = paymentIntent?.metadata?.orderId;

  const update = {
    stripePaymentIntentId: paymentIntent.id || null,
    stripePaymentStatus: paymentIntent.status || "succeeded",
    stripeChargeId:
      typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge && typeof paymentIntent.latest_charge === "object"
          ? paymentIntent.latest_charge.id
          : null,
  };

  if (orderId) {
    await BuyerOrder.findByIdAndUpdate(orderId, { $set: update });
    return;
  }

  if (paymentIntent.id) {
    await BuyerOrder.findOneAndUpdate({ stripePaymentIntentId: paymentIntent.id }, { $set: update });
  }
};

const _handlePaymentIntentFailedOrCanceled = async (paymentIntent, nextStatus) => {
  const orderId = paymentIntent?.metadata?.orderId;
  const filter = orderId ? { _id: orderId } : { stripePaymentIntentId: paymentIntent?.id };
  if (!filter._id && !filter.stripePaymentIntentId) return;

  await BuyerOrder.findOneAndUpdate(filter, {
    $set: {
      stripePaymentIntentId: paymentIntent?.id || null,
      stripePaymentStatus: paymentIntent?.status || nextStatus,
      paymentStatus: "failed",
      escrowStatus: "awaiting_payment",
      trackingStage: "awaiting_payment",
      trackingUpdatedAt: new Date(),
    },
  });
};

const stripeWebhook = async (req, res) => {
  if (!isStripeEnabled()) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  let event;
  const signature = req.headers["stripe-signature"];
  const webhookSecret = getStripeWebhookSecret();

  try {
    if (webhookSecret) {
      event = getStripeClient().webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = _parseRawJsonBody(req.body);
    }
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await _handleCheckoutCompleted(event.data.object);
        break;
      case "checkout.session.expired":
        await _handleCheckoutExpired(event.data.object);
        break;
      case "payment_intent.succeeded":
        await _handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await _handlePaymentIntentFailedOrCanceled(event.data.object, event.type);
        break;
      default:
        break;
    }
  } catch (error) {
    const orderId = _resolveOrderIdFromEvent(event);
    console.error("Stripe webhook processing error:", {
      type: event.type,
      orderId,
      message: error.message,
    });
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.status(200).json({ received: true });
};

module.exports = {
  stripeWebhook,
};
