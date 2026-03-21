const BuyerOrder = require("../models/BuyerOrder");
const Batch = require("../models/Batch");
const {
  getFlutterwaveProviderFromMethod,
  getFlutterwaveProviderFromNetwork,
  normalizeFlutterwavePaymentState,
  verifyFlutterwaveTransaction,
} = require("./flutterwaveService");

const _extractVerificationData = (payload) =>
  payload?.data && typeof payload.data === "object" ? payload.data : payload || {};

const _assignIfChanged = (target, key, value) => {
  if (value === undefined) return false;
  if (target[key] === value) return false;
  target[key] = value;
  return true;
};

const _markBatchSoldIfFunded = async (order) => {
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

const _resolveMethod = (order, verificationData) => {
  const metaMethod = String(verificationData?.meta?.paymentMethod || "").trim().toLowerCase();
  if (metaMethod) {
    const provider = getFlutterwaveProviderFromMethod(metaMethod);
    if (provider) return provider;
  }

  const networkProvider = getFlutterwaveProviderFromNetwork(
    verificationData?.network ||
      verificationData?.payment_type_details?.network ||
      verificationData?.payment_options?.network,
  );
  if (networkProvider) return networkProvider;

  return getFlutterwaveProviderFromMethod(order?.paymentMethod);
};

const findBuyerOrderForFlutterwaveIdentifiers = async ({
  orderId,
  txRef,
  externalId,
  flwRef,
}) => {
  if (orderId) {
    const byId = await BuyerOrder.findById(orderId);
    if (byId) return byId;
  }

  if (txRef) {
    const byRef = await BuyerOrder.findOne({ mobileMoneyReference: String(txRef) });
    if (byRef) return byRef;
  }

  if (externalId) {
    const byExternalId = await BuyerOrder.findOne({
      $or: [
        { mobileMoneyExternalId: String(externalId) },
        { mobileMoneyTransactionId: String(externalId) },
      ],
    });
    if (byExternalId) return byExternalId;
  }

  if (flwRef) {
    return BuyerOrder.findOne({
      $or: [
        { mobileMoneyTransactionId: String(flwRef) },
        { mobileMoneyExternalId: String(flwRef) },
      ],
    });
  }

  return null;
};

const applyFlutterwaveVerificationToOrder = async ({
  order,
  verificationPayload,
  receivedAt = new Date(),
}) => {
  if (!order) {
    throw new Error("Order document is required to apply Flutterwave verification");
  }

  const verificationData = _extractVerificationData(verificationPayload);
  const provider = _resolveMethod(order, verificationData);
  const paymentState = normalizeFlutterwavePaymentState(verificationData?.status);
  const amountCaptured = Number(
    verificationData?.amount ??
      verificationData?.charged_amount ??
      verificationData?.amount_settled ??
      0,
  );
  const expectedAmount = Math.round(Number(order.amountDueToday) || 0);
  const currency = String(verificationData?.currency || order.currency || "").toUpperCase();
  const expectedCurrency = String(order.currency || "").toUpperCase();
  const txRef = verificationData?.tx_ref ? String(verificationData.tx_ref) : null;
  const externalId = verificationData?.id != null ? String(verificationData.id) : null;
  const flwRef = verificationData?.flw_ref ? String(verificationData.flw_ref) : null;
  const payerMsisdn =
    verificationData?.customer?.phone_number ||
    verificationData?.phone_number ||
    order.mobileMoneyPayerMsisdn ||
    null;

  let hasChanges = false;
  hasChanges = _assignIfChanged(order, "mobileMoneyProvider", provider?.slug || order.mobileMoneyProvider) || hasChanges;
  hasChanges =
    _assignIfChanged(order, "mobileMoneyProviderCode", provider?.providerCode || order.mobileMoneyProviderCode) || hasChanges;
  hasChanges = _assignIfChanged(order, "mobileMoneyReference", txRef || order.mobileMoneyReference) || hasChanges;
  hasChanges = _assignIfChanged(order, "mobileMoneyExternalId", externalId || order.mobileMoneyExternalId) || hasChanges;
  hasChanges = _assignIfChanged(order, "mobileMoneyTransactionId", flwRef || order.mobileMoneyTransactionId) || hasChanges;
  hasChanges = _assignIfChanged(order, "mobileMoneyStatus", paymentState) || hasChanges;
  hasChanges = _assignIfChanged(order, "mobileMoneyPayerMsisdn", payerMsisdn) || hasChanges;

  const capturedEnough = amountCaptured >= expectedAmount;
  const currencyMatches = !expectedCurrency || currency === expectedCurrency;
  const isSuccessful = paymentState === "successful" && capturedEnough && currencyMatches;
  const isFailed = paymentState === "failed";

  if (isSuccessful) {
    hasChanges = _assignIfChanged(order, "paymentStatus", "deposit_paid") || hasChanges;
    hasChanges = _assignIfChanged(order, "escrowStatus", "funded") || hasChanges;
    hasChanges = _assignIfChanged(order, "trackingStage", "payment_confirmed") || hasChanges;
    if (!order.paymentConfirmedAt) {
      order.paymentConfirmedAt = receivedAt;
      hasChanges = true;
    }
    if (!order.escrowFundedAt) {
      order.escrowFundedAt = receivedAt;
      hasChanges = true;
    }
  } else if (isFailed && String(order.paymentStatus || "").toLowerCase() !== "deposit_paid") {
    hasChanges = _assignIfChanged(order, "paymentStatus", "failed") || hasChanges;
    hasChanges = _assignIfChanged(order, "escrowStatus", "awaiting_payment") || hasChanges;
    hasChanges = _assignIfChanged(order, "trackingStage", "awaiting_payment") || hasChanges;
  }

  order.mobileMoneyLastWebhookAt = receivedAt;
  order.trackingUpdatedAt = receivedAt;
  hasChanges = true;

  if (hasChanges) {
    await order.save();
    await _markBatchSoldIfFunded(order);
  }

  return {
    order,
    paymentState: isSuccessful ? "successful" : isFailed ? "failed" : "pending",
    verificationData,
  };
};

const syncBuyerOrderWithFlutterwaveTransaction = async ({
  order,
  transactionId,
  receivedAt = new Date(),
}) => {
  const verificationPayload = await verifyFlutterwaveTransaction(transactionId);
  return applyFlutterwaveVerificationToOrder({
    order,
    verificationPayload,
    receivedAt,
  });
};

module.exports = {
  applyFlutterwaveVerificationToOrder,
  findBuyerOrderForFlutterwaveIdentifiers,
  syncBuyerOrderWithFlutterwaveTransaction,
};
