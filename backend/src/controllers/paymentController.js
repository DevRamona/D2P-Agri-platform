const BuyerOrder = require("../models/BuyerOrder");
const Batch = require("../models/Batch");
const {
  buildFlutterwaveFrontendTrackingUrl,
  getFlutterwaveSecretHash,
  isFlutterwaveEnabled,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookSignature,
} = require("../services/flutterwaveService");
const {
  applyFlutterwaveVerificationToOrder,
  findBuyerOrderForFlutterwaveIdentifiers,
} = require("../services/flutterwaveOrderService");
const {
  getStripeClient,
  getStripeWebhookSecret,
  isStripeEnabled: isStripeCheckoutEnabled,
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

const _extractFlutterwavePayloadData = (payload) =>
  payload?.data && typeof payload.data === "object" ? payload.data : payload || {};

const _markBatchSoldForOrderId = async (orderId) => {
  if (!orderId) return;
  const order = await BuyerOrder.findById(orderId).select("batch paymentStatus escrowStatus").lean();
  if (!order?.batch) return;
  if (String(order.paymentStatus || "").toLowerCase() !== "deposit_paid") return;
  if (String(order.escrowStatus || "").toLowerCase() !== "funded") return;

  await Batch.findByIdAndUpdate(order.batch, {
    $set: {
      status: "sold",
      soldAt: new Date(),
    },
  });
};

const _findOrderFromFlutterwavePayload = async (payload, fallbackOrderId) => {
  const data = _extractFlutterwavePayloadData(payload);
  return findBuyerOrderForFlutterwaveIdentifiers({
    orderId: data?.meta?.orderId || fallbackOrderId || null,
    txRef: data?.tx_ref || null,
    externalId: data?.id != null ? String(data.id) : null,
    flwRef: data?.flw_ref || null,
  });
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
  if (session.payment_status === "paid") {
    await _markBatchSoldForOrderId(orderId);
  }
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
  if (!isStripeCheckoutEnabled()) {
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

const flutterwaveWebhook = async (req, res) => {
  if (!isFlutterwaveEnabled()) {
    return res.status(503).json({ error: "Flutterwave not configured" });
  }

  if (!getFlutterwaveSecretHash()) {
    return res.status(503).json({ error: "Flutterwave webhook secret hash is not configured" });
  }

  const providedSignature = req.headers["flutterwave-signature"] || req.headers["verif-hash"];
  if (!verifyFlutterwaveWebhookSignature(req.body, providedSignature)) {
    return res.status(401).json({ error: "Invalid Flutterwave signature" });
  }

  let payload;
  try {
    payload = _parseRawJsonBody(req.body);
  } catch (error) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  const receivedAt = new Date();
  const incomingData = _extractFlutterwavePayloadData(payload);
  const transactionId = incomingData?.id != null ? String(incomingData.id) : null;
  if (!transactionId) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const verificationPayload = await verifyFlutterwaveTransaction(transactionId);
    const order = await _findOrderFromFlutterwavePayload(verificationPayload, incomingData?.meta?.orderId);
    if (!order) {
      return res.status(200).json({ received: true, ignored: true });
    }

    await applyFlutterwaveVerificationToOrder({
      order,
      verificationPayload,
      receivedAt,
    });
  } catch (error) {
    console.error("Flutterwave webhook processing error:", {
      transactionId,
      message: error.message,
    });
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.status(200).json({ received: true });
};

const flutterwaveCallback = async (req, res) => {
  const fallbackOrderId = String(req.query.orderId || "").trim();
  const fallbackMethod = String(req.query.provider || "").trim().toLowerCase();
  const txRef = String(req.query.tx_ref || "").trim();
  const transactionId = String(req.query.transaction_id || req.query.id || "").trim();
  const callbackStatus = String(req.query.status || "").trim().toLowerCase();
  let order = await findBuyerOrderForFlutterwaveIdentifiers({
    orderId: fallbackOrderId || null,
    txRef: txRef || null,
    externalId: transactionId || null,
  });
  let paymentState = callbackStatus || "pending";

  if (transactionId && isFlutterwaveEnabled()) {
    try {
      const verificationPayload = await verifyFlutterwaveTransaction(transactionId);
      order = order || (await _findOrderFromFlutterwavePayload(verificationPayload, fallbackOrderId));
      if (order) {
        const applied = await applyFlutterwaveVerificationToOrder({
          order,
          verificationPayload,
          receivedAt: new Date(),
        });
        order = applied.order;
        paymentState = applied.paymentState;
      }
    } catch (error) {
      console.error("Flutterwave callback verification error:", {
        transactionId,
        orderId: fallbackOrderId || null,
        message: error.message,
      });
    }
  }

  const redirectUrl = buildFlutterwaveFrontendTrackingUrl({
    orderId: order ? String(order._id) : fallbackOrderId,
    method: order?.paymentMethod || fallbackMethod,
    checkoutState: "mobile_money",
    status: paymentState || "pending",
  });
  return res.redirect(302, redirectUrl);
};

module.exports = {
  flutterwaveCallback,
  flutterwaveWebhook,
  stripeWebhook,
};
