const crypto = require("crypto");

const FLUTTERWAVE_PROVIDER_BY_METHOD = {
  momo: {
    method: "momo",
    slug: "mtn",
    network: "MTN",
    providerCode: "mtn_momo",
    providerLabel: "MTN Mobile Money",
  },
  airtel: {
    method: "airtel",
    slug: "airtel",
    network: "AIRTEL",
    providerCode: "airtel_money",
    providerLabel: "Airtel Money",
  },
};

const _trimTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const _getJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
};

const _requestFlutterwave = async ({ path, method = "GET", payload }) => {
  const secretKey = String(process.env.FLUTTERWAVE_SECRET_KEY || "").trim();
  if (!secretKey) {
    throw new Error("Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY.");
  }

  const baseUrl = _trimTrailingSlash(process.env.FLUTTERWAVE_API_BASE_URL || "https://api.flutterwave.com/v3");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const body = await _getJson(response);
  if (!response.ok) {
    const message =
      body?.message ||
      body?.error?.message ||
      body?.raw ||
      `Flutterwave request failed with status ${response.status}`;
    const error = new Error(message);
    error.code = `FLUTTERWAVE_${response.status}`;
    error.details = body;
    error.request = payload || null;
    throw error;
  }

  return body;
};

const isFlutterwaveEnabled = () => Boolean(String(process.env.FLUTTERWAVE_SECRET_KEY || "").trim());

const getFlutterwaveSecretHash = () => String(process.env.FLUTTERWAVE_SECRET_HASH || "").trim();

const isFlutterwaveMobileMoneyMethod = (method) =>
  Object.prototype.hasOwnProperty.call(FLUTTERWAVE_PROVIDER_BY_METHOD, String(method || "").trim().toLowerCase());

const getFlutterwaveProviderFromMethod = (method) =>
  FLUTTERWAVE_PROVIDER_BY_METHOD[String(method || "").trim().toLowerCase()] || null;

const getFlutterwaveProviderFromNetwork = (network) => {
  const normalized = String(network || "").trim().toUpperCase();
  if (normalized === "MTN") return FLUTTERWAVE_PROVIDER_BY_METHOD.momo;
  if (normalized === "AIRTEL") return FLUTTERWAVE_PROVIDER_BY_METHOD.airtel;
  return null;
};

const normalizeFlutterwavePaymentState = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "pending";
  if (["successful", "completed", "paid"].includes(normalized)) return "successful";
  if (["failed", "cancelled", "canceled", "expired", "error"].includes(normalized)) return "failed";
  return normalized;
};

const buildFlutterwaveCallbackUrl = ({ orderId, method }) => {
  const backendBase = _trimTrailingSlash(process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`);
  const search = new URLSearchParams({
    orderId: String(orderId || ""),
    provider: String(method || ""),
  });
  return `${backendBase}/payments/flutterwave/callback?${search.toString()}`;
};

const buildFlutterwaveFrontendTrackingUrl = ({ orderId, method, checkoutState = "mobile_money", status }) => {
  const frontendBase = _trimTrailingSlash(process.env.FRONTEND_PUBLIC_URL || "http://localhost:5173");
  const search = new URLSearchParams({
    orderId: String(orderId || ""),
    checkout: checkoutState,
  });
  if (method) search.set("provider", String(method));
  if (status) search.set("status", String(status));
  return `${frontendBase}/buyer/order-tracking?${search.toString()}`;
};

const createFlutterwaveRwandaMobileMoneyCharge = async ({ order, buyer, method }) => {
  const provider = getFlutterwaveProviderFromMethod(method || order?.paymentMethod);
  if (!provider) {
    throw new Error(`Unsupported Flutterwave mobile money method: ${String(method || order?.paymentMethod || "")}`);
  }

  const amount = Math.round(Number(order?.amountDueToday) || 0);
  if (amount <= 0) {
    throw new Error("Order amount due today must be greater than zero");
  }

  const buyerEmail = String(buyer?.email || "").trim();
  const buyerPhoneNumber = String(buyer?.phoneNumber || "").trim();
  if (!buyerEmail) {
    throw new Error("Buyer email is required for Flutterwave mobile money checkout");
  }
  if (!buyerPhoneNumber) {
    throw new Error("Buyer phone number is required for Flutterwave mobile money checkout");
  }

  const txRef =
    String(order?.mobileMoneyReference || "").trim() ||
    `fw_${provider.slug}_${String(order?.orderNumber || order?._id || "order").replace(/[^a-zA-Z0-9_-]/g, "")}_${Date.now()}`;

  const payload = {
    tx_ref: txRef,
    amount,
    currency: String(order?.currency || "RWF").toUpperCase(),
    email: buyerEmail,
    phone_number: buyerPhoneNumber,
    fullname: String(buyer?.fullName || order?.buyerName || "Buyer").trim(),
    network: provider.network,
    redirect_url: buildFlutterwaveCallbackUrl({
      orderId: String(order?._id || ""),
      method: provider.method,
    }),
    meta: {
      orderId: String(order?._id || ""),
      orderNumber: String(order?.orderNumber || ""),
      buyerId: String(order?.buyer || buyer?._id || ""),
      farmerId: String(order?.farmer || ""),
      paymentType: "deposit_escrow",
      paymentMethod: provider.method,
    },
  };

  const body = await _requestFlutterwave({
    path: "/charges?type=mobile_money_rwanda",
    method: "POST",
    payload,
  });

  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const meta = body?.meta && typeof body.meta === "object" ? body.meta : {};
  const authorization =
    (meta.authorization && typeof meta.authorization === "object" ? meta.authorization : null) ||
    (data.authorization && typeof data.authorization === "object" ? data.authorization : null) ||
    {};

  return {
    provider: "flutterwave",
    paymentRail: "mobile_money",
    method: provider.method,
    providerSlug: provider.slug,
    providerCode: provider.providerCode,
    providerLabel: provider.providerLabel,
    txRef,
    externalId: data?.id != null ? String(data.id) : null,
    flwRef: data?.flw_ref ? String(data.flw_ref) : null,
    status: normalizeFlutterwavePaymentState(data?.status || "pending"),
    redirectUrl:
      authorization.redirect ||
      data?.redirect_url ||
      data?.link ||
      null,
    raw: body,
    request: payload,
  };
};

const verifyFlutterwaveTransaction = async (transactionId) => {
  if (!transactionId) {
    throw new Error("transactionId is required to verify a Flutterwave transaction");
  }

  return _requestFlutterwave({
    path: `/transactions/${encodeURIComponent(String(transactionId))}/verify`,
    method: "GET",
  });
};

const verifyFlutterwaveWebhookSignature = (rawBody, providedSignature) => {
  const secretHash = getFlutterwaveSecretHash();
  if (!secretHash || !rawBody || !providedSignature) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secretHash)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)))
    .digest("hex");

  const actual = String(providedSignature).trim();
  if (expectedSignature.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(actual));
};

module.exports = {
  buildFlutterwaveCallbackUrl,
  buildFlutterwaveFrontendTrackingUrl,
  createFlutterwaveRwandaMobileMoneyCharge,
  getFlutterwaveProviderFromMethod,
  getFlutterwaveProviderFromNetwork,
  getFlutterwaveSecretHash,
  isFlutterwaveEnabled,
  isFlutterwaveMobileMoneyMethod,
  normalizeFlutterwavePaymentState,
  verifyFlutterwaveTransaction,
  verifyFlutterwaveWebhookSignature,
};
