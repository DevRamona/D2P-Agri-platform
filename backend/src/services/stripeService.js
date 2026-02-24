const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

let stripeClient = null;

const isStripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

const getStripeClient = () => {
  if (!isStripeEnabled()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }

  if (!stripeClient) {
    let Stripe;
    try {
      Stripe = require("stripe");
    } catch (error) {
      throw new Error("Stripe SDK is not installed. Run `npm install` in backend.");
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

const getStripeWebhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET || "";

const getStripeCurrency = (fallback = "rwf") =>
  String(process.env.STRIPE_CURRENCY || fallback || "rwf")
    .trim()
    .toLowerCase();

const isZeroDecimalCurrency = (currency) => ZERO_DECIMAL_CURRENCIES.has(String(currency || "").toLowerCase());

const toStripeAmountMinorUnits = (amount, currency) => {
  const numericAmount = Number(amount) || 0;
  const normalizedCurrency = String(currency || "").toLowerCase();
  if (numericAmount < 0) {
    throw new Error("Stripe amount cannot be negative");
  }

  if (isZeroDecimalCurrency(normalizedCurrency)) {
    return Math.round(numericAmount);
  }
  return Math.round(numericAmount * 100);
};

const buildStripeCheckoutUrls = (orderId) => {
  const successTemplate =
    process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
    "http://localhost:5173/buyer/order-tracking?orderId={ORDER_ID}&checkout=success&session_id={CHECKOUT_SESSION_ID}";
  const cancelTemplate =
    process.env.STRIPE_CHECKOUT_CANCEL_URL ||
    "http://localhost:5173/buyer/order-review?orderId={ORDER_ID}&checkout=cancelled";

  const replaceTokens = (template) =>
    String(template)
      .replaceAll("{ORDER_ID}", String(orderId))
      .replaceAll("{CHECKOUT_SESSION_ID}", "{CHECKOUT_SESSION_ID}");

  return {
    successUrl: replaceTokens(successTemplate),
    cancelUrl: replaceTokens(cancelTemplate),
  };
};

const createBuyerOrderCheckoutSession = async ({ order, buyer }) => {
  const stripe = getStripeClient();
  const currency = getStripeCurrency(order.currency || "rwf");
  const amountMinor = toStripeAmountMinorUnits(order.amountDueToday, currency);

  if (amountMinor <= 0) {
    throw new Error("Order amount due today must be greater than zero");
  }

  const transferGroup = order.stripeTransferGroup || `buyer_order_${order.orderNumber || String(order._id)}`;
  const { successUrl, cancelUrl } = buildStripeCheckoutUrls(order._id);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: buyer?.email || undefined,
    client_reference_id: String(order._id),
    payment_method_types: ["card"],
    metadata: {
      orderId: String(order._id),
      orderNumber: String(order.orderNumber || ""),
      buyerId: String(order.buyer),
      farmerId: String(order.farmer),
      paymentType: "deposit_escrow",
      paymentMethodPreference: String(order.paymentMethod || "momo"),
      transferGroup,
    },
    payment_intent_data: {
      transfer_group: transferGroup,
      metadata: {
        orderId: String(order._id),
        orderNumber: String(order.orderNumber || ""),
        buyerId: String(order.buyer),
        farmerId: String(order.farmer),
        paymentType: "deposit_escrow",
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountMinor,
          product_data: {
            name: `Escrow Deposit - ${order.title}`,
            description: `Order ${order.orderNumber} (${Math.round(Number(order.totalWeight) || 0)}kg)`,
          },
        },
      },
    ],
  });

  return {
    sessionId: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    currency: currency.toUpperCase(),
    transferGroup,
  };
};

const createEscrowReleaseTransfer = async ({ order, farmerStripeAccountId }) => {
  const stripe = getStripeClient();
  const currency = getStripeCurrency(order.currency || "rwf");
  const transferAmountMinor = toStripeAmountMinorUnits(order.depositAmount, currency);

  if (transferAmountMinor <= 0) {
    throw new Error("Deposit amount must be greater than zero for release");
  }

  const transferPayload = {
    amount: transferAmountMinor,
    currency,
    destination: farmerStripeAccountId,
    transfer_group: order.stripeTransferGroup || `buyer_order_${order.orderNumber || String(order._id)}`,
    metadata: {
      orderId: String(order._id),
      orderNumber: String(order.orderNumber || ""),
      releaseType: "deposit_escrow_release",
      farmerId: String(order.farmer),
      buyerId: String(order.buyer),
    },
  };

  if (order.stripeChargeId) {
    transferPayload.source_transaction = order.stripeChargeId;
  }

  const transfer = await stripe.transfers.create(transferPayload);
  return transfer;
};

module.exports = {
  createBuyerOrderCheckoutSession,
  createEscrowReleaseTransfer,
  getStripeClient,
  getStripeCurrency,
  getStripeWebhookSecret,
  isStripeEnabled,
  toStripeAmountMinorUnits,
};
