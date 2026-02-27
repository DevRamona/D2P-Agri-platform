const BuyerOrder = require("../models/BuyerOrder");
const PayoutAudit = require("../models/PayoutAudit");
const { User } = require("../models/User");
const { createEscrowReleaseTransfer, isStripeEnabled } = require("./stripeService");
const { createMobileMoneyPayoutTransfer, isMobileMoneyMethod } = require("./mobileMoneyService");

const _normalizeMethod = (method) => {
  const normalized = String(method || "").trim().toLowerCase();
  return ["card", "momo", "airtel", "bank"].includes(normalized) ? normalized : "unknown";
};

const _baseAuditData = ({ order, actorUserId, provider, method, paymentRail, executionMode, status }) => ({
  order: order._id,
  batch: order.batch || null,
  buyer: order.buyer || null,
  farmer: order.farmer || null,
  initiatedBy: actorUserId || null,
  provider,
  method,
  paymentRail,
  executionMode,
  status,
  amount: Math.round(Number(order.depositAmount) || Number(order.amountDueToday) || 0),
  currency: String(order.currency || "RWF").toUpperCase(),
  processedAt: new Date(),
});

const _markReleased = async (orderId, extras = {}) => {
  const now = new Date();
  await BuyerOrder.findByIdAndUpdate(orderId, {
    $set: {
      escrowStatus: "released",
      escrowReleasedAt: now,
      trackingStage: "released_for_delivery",
      trackingUpdatedAt: now,
      ...extras,
    },
  });
  return now;
};

const _markReleaseFailed = async (orderId) => {
  const now = new Date();
  await BuyerOrder.findByIdAndUpdate(orderId, {
    $set: {
      escrowStatus: "release_failed",
      trackingUpdatedAt: now,
    },
  });
  return now;
};

const releaseEscrowPayoutForOrder = async ({ order, actorUserId }) => {
  const method = _normalizeMethod(order.paymentMethod);
  const farmer = await User.findById(order.farmer).select("fullName phoneNumber stripeConnectAccountId").lean();

  if (!farmer) {
    const audit = await PayoutAudit.create({
      ..._baseAuditData({
        order,
        actorUserId,
        provider: "unknown",
        method,
        paymentRail: "unknown",
        executionMode: "live",
        status: "failed",
      }),
      errorCode: "FARMER_NOT_FOUND",
      errorMessage: "Farmer account not found for payout release",
    });
    await _markReleaseFailed(order._id);
    return { ok: false, audit, error: "Farmer account not found" };
  }

  try {
    if (method === "card") {
      if (!isStripeEnabled()) {
        throw Object.assign(new Error("Stripe is not configured"), { code: "STRIPE_NOT_CONFIGURED" });
      }
      if (!farmer.stripeConnectAccountId) {
        throw Object.assign(new Error("Farmer Stripe Connect account is not configured"), { code: "FARMER_PAYOUT_NOT_CONFIGURED" });
      }

      const transfer = await createEscrowReleaseTransfer({
        order,
        farmerStripeAccountId: farmer.stripeConnectAccountId,
      });

      const releasedAt = await _markReleased(order._id, {
        stripeTransferId: transfer.id || null,
      });

      const audit = await PayoutAudit.create({
        ..._baseAuditData({
          order,
          actorUserId,
          provider: "stripe",
          method,
          paymentRail: "card",
          executionMode: "live",
          status: "succeeded",
        }),
        externalReference: transfer.id || null,
        providerCode: "stripe",
        providerLabel: "Stripe Connect",
        providerRequest: {
          destination: farmer.stripeConnectAccountId,
          transferGroup: order.stripeTransferGroup || null,
        },
        providerResponse: {
          id: transfer.id,
          status: transfer.object || "transfer",
          created: transfer.created || null,
        },
        processedAt: releasedAt,
      });

      return {
        ok: true,
        audit,
        provider: "stripe",
        method,
        releasedAt,
        externalReference: transfer.id || null,
      };
    }

    if (isMobileMoneyMethod(method)) {
      const payout = await createMobileMoneyPayoutTransfer({ order, farmer, method });
      const releasedAt = await _markReleased(order._id);
      const audit = await PayoutAudit.create({
        ..._baseAuditData({
          order,
          actorUserId,
          provider: "mobile_money",
          method,
          paymentRail: "mobile_money",
          executionMode: payout.executionMode || "stub",
          status: payout.executionMode === "live" ? "submitted" : "submitted",
        }),
        externalReference: payout.externalReference || null,
        providerCode: payout.providerCode || null,
        providerLabel: payout.providerLabel || null,
        providerRequest: payout.request || null,
        providerResponse: payout.response || null,
        processedAt: releasedAt,
      });

      return {
        ok: true,
        audit,
        provider: "mobile_money",
        method,
        releasedAt,
        externalReference: payout.externalReference || null,
        executionMode: payout.executionMode,
      };
    }

    if (method === "bank") {
      const audit = await PayoutAudit.create({
        ..._baseAuditData({
          order,
          actorUserId,
          provider: "bank_transfer",
          method,
          paymentRail: "bank_transfer",
          executionMode: "stub",
          status: "manual_required",
        }),
        errorCode: "MANUAL_PAYOUT_REQUIRED",
        errorMessage: "Bank transfer payouts require manual reconciliation and are not auto-released.",
      });

      return { ok: false, audit, error: "Manual bank payout required", skipped: true };
    }

    throw Object.assign(new Error(`Unsupported payout method: ${method}`), { code: "UNSUPPORTED_PAYOUT_METHOD" });
  } catch (error) {
    const releasedFailedAt = await _markReleaseFailed(order._id);
    const audit = await PayoutAudit.create({
      ..._baseAuditData({
        order,
        actorUserId,
        provider: method === "card" ? "stripe" : isMobileMoneyMethod(method) ? "mobile_money" : "unknown",
        method,
        paymentRail: method === "card" ? "card" : isMobileMoneyMethod(method) ? "mobile_money" : "unknown",
        executionMode: "live",
        status: "failed",
      }),
      errorCode: error.code || "PAYOUT_EXECUTION_FAILED",
      errorMessage: error.message || "Payout execution failed",
      providerRequest: error.request || null,
      providerResponse: error.details || null,
      processedAt: releasedFailedAt,
    });
    return { ok: false, audit, error: error.message || "Payout failed" };
  }
};

module.exports = {
  releaseEscrowPayoutForOrder,
};

