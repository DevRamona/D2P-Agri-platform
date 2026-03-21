import { useState } from "react";
import { createBuyerOrder, createBuyerOrderCheckoutSession } from "../api/buyer";
import { API_BASE } from "../api/client";
import type { ViewMode } from "../types";
import {
  formatOrderReference,
  getBuyerOrderQuote,
  getBuyerSelectedBatch,
  setBuyerSelectedOrder,
} from "../utils/buyerCheckout";

interface OrderReviewProps {
  onNavigate?: (view: ViewMode) => void;
}

const FALLBACK_IMAGE = "https://placehold.co/600x400?text=Selected+Batch";

const formatCurrency = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

type PaymentMethod = "card" | "momo" | "airtel" | "bank";
type MobileMoneyMethod = Extract<PaymentMethod, "momo" | "airtel">;
type PaymentOption = {
  value: PaymentMethod;
  badge: string;
  badgeClassName: string;
  label: string;
  description: string;
  disabled: boolean;
};

const MOBILE_MONEY_ENABLED = String(import.meta.env.VITE_ENABLE_MOBILE_MONEY || "true").toLowerCase() === "true";
const MOBILE_MONEY_STUB_ENABLED = String(import.meta.env.VITE_ENABLE_STUB_MOBILE_MONEY || "false").toLowerCase() === "true";
const BANK_TRANSFER_ENABLED = String(import.meta.env.VITE_ENABLE_BANK_TRANSFER || "false").toLowerCase() === "true";
const PRIMARY_MOBILE_MONEY_METHOD: MobileMoneyMethod =
  String(import.meta.env.VITE_PRIMARY_PAYMENT_METHOD || "momo").toLowerCase() === "airtel" ? "airtel" : "momo";
const SECONDARY_MOBILE_MONEY_METHOD: MobileMoneyMethod =
  PRIMARY_MOBILE_MONEY_METHOD === "momo" ? "airtel" : "momo";

const getPaymentOptionConfig = (method: PaymentMethod): PaymentOption => {
  if (method === "momo") {
    return {
      value: "momo",
      badge: "MoMo",
      badgeClassName: "bg-yellow-400 text-black",
      label: "MTN Mobile Money",
      description:
        !MOBILE_MONEY_ENABLED
          ? "Disabled in this environment"
          : MOBILE_MONEY_STUB_ENABLED && PRIMARY_MOBILE_MONEY_METHOD === "momo"
            ? "Primary checkout path in stub/test mode"
            : MOBILE_MONEY_STUB_ENABLED
              ? "Alternative mobile money option in stub/test mode"
              : "Collected through Flutterwave",
      disabled: !MOBILE_MONEY_ENABLED,
    };
  }

  if (method === "airtel") {
    return {
      value: "airtel",
      badge: "Airtel",
      badgeClassName: "bg-red-500 text-white",
      label: "Airtel Money",
      description:
        !MOBILE_MONEY_ENABLED
          ? "Disabled in this environment"
          : MOBILE_MONEY_STUB_ENABLED && PRIMARY_MOBILE_MONEY_METHOD === "airtel"
            ? "Primary checkout path in stub/test mode"
            : MOBILE_MONEY_STUB_ENABLED
              ? "Alternative mobile money option in stub/test mode"
              : "Collected through Flutterwave",
      disabled: !MOBILE_MONEY_ENABLED,
    };
  }

  if (method === "bank") {
    return {
      value: "bank",
      badge: "Bank",
      badgeClassName: "bg-slate-700 text-white",
      label: "Bank Transfer",
      description: BANK_TRANSFER_ENABLED ? "Manual reconciliation required" : "Disabled in this environment",
      disabled: !BANK_TRANSFER_ENABLED,
    };
  }

  return {
    value: "card",
    badge: "Card",
    badgeClassName: "bg-emerald-600 text-white",
    label: "Card (Stripe Checkout)",
    description: "Fallback checkout via Stripe",
    disabled: false,
  };
};

const resolveInitialPaymentMethod = (): PaymentMethod => {
  if (MOBILE_MONEY_ENABLED) {
    return PRIMARY_MOBILE_MONEY_METHOD;
  }
  if (BANK_TRANSFER_ENABLED) {
    return "bank";
  }
  return "card";
};

const OrderReview = ({ onNavigate }: OrderReviewProps) => {
  const selectedBatch = getBuyerSelectedBatch();
  const quote = getBuyerOrderQuote(selectedBatch);
  const depositPercentLabel = `${Math.round(quote.depositPercent * 100)}%`;
  const orderRef = formatOrderReference(selectedBatch?.id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(resolveInitialPaymentMethod);
  const paymentOptions: PaymentOption[] = [
    getPaymentOptionConfig(PRIMARY_MOBILE_MONEY_METHOD),
    getPaymentOptionConfig(SECONDARY_MOBILE_MONEY_METHOD),
    getPaymentOptionConfig("card"),
    getPaymentOptionConfig("bank"),
  ];

  if (!selectedBatch) {
    return (
      <section className="app-screen app-screen-comfort flex flex-col gap-6">
        <header className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            onClick={() => onNavigate?.("buyer-marketplace")}
            aria-label="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className="m-0 text-base font-semibold">Order Review &amp; Deposit</p>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>

        <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          No selected batch found. Start from the buyer marketplace and choose a farmer batch to continue checkout.
        </div>

        <button
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307]"
          type="button"
          onClick={() => onNavigate?.("buyer-marketplace")}
        >
          Browse Marketplace
        </button>
      </section>
    );
  }

  return (
    <section className="app-screen app-screen-comfort flex flex-col gap-6">
      <header className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("buyer-batch-details")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">Order Review &amp; Deposit</p>
        <span className="h-10 w-10" aria-hidden="true" />
      </header>

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-[16px] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
          {notice}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center">
        <img
          src={resolveImageUrl(selectedBatch.image)}
          alt={selectedBatch.title}
          className="h-16 w-16 rounded-[14px] object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        <div>
          <p className="m-0 text-xs font-semibold text-[var(--accent)]">Confirmed Order · {orderRef}</p>
          <p className="mt-1 text-sm font-semibold">{selectedBatch.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {Math.round(selectedBatch.totalWeight).toLocaleString()}kg · {selectedBatch.destination}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Farmer: {selectedBatch.farmerName}</p>
          <p className="mt-2 text-sm font-semibold">{formatCurrency(selectedBatch.totalPrice)} Total</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Payment Split</h3>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--accent)]">
          Escrow Protected
        </span>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-xs text-[var(--muted)]">Deposit Amount ({depositPercentLabel})</p>
            <p className="mt-2 text-2xl font-bold text-[var(--accent)]">{formatCurrency(quote.depositAmount)}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-xs text-[var(--muted)]">Balance Due on Delivery</p>
            <p className="mt-2 text-base font-semibold">{formatCurrency(quote.balanceDue)}</p>
          </div>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-[var(--surface-2)]">
          <div className="h-3 rounded-full bg-[var(--accent)]" style={{ width: `${quote.depositPercent * 100}%` }} />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] p-4 text-xs text-[var(--muted)]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
          <p className="m-0">
            Your {formatCurrency(quote.amountDueToday)} payment will be held in escrow. Funds are released to the
            farmer after delivery and quality confirmation in the app.
          </p>
        </div>
      </div>

      <div>
        <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">Detailed Breakdown</p>
      </div>
      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span>Order Deposit ({depositPercentLabel})</span>
          <span className="text-[var(--text)]">{formatCurrency(quote.depositAmount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[var(--muted)]">
          <span>Service Fee</span>
          <span className="text-[var(--text)]">{formatCurrency(quote.serviceFee)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-[var(--muted)]">
          <span>Logistics Insurance</span>
          <span className={quote.insuranceFee > 0 ? "text-[var(--text)]" : "text-[var(--accent)]"}>
            {quote.insuranceFee > 0 ? formatCurrency(quote.insuranceFee) : "Free"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--stroke)] pt-4 font-semibold">
          <span>Amount Due Today</span>
          <span className="text-[var(--accent)]">{formatCurrency(quote.amountDueToday)}</span>
        </div>
      </div>

      <div>
        <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">Payment Method</p>
      </div>
      <div className="flex flex-col gap-3">
        {paymentOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`flex items-center justify-between rounded-[18px] px-4 py-3 ${
              paymentMethod === option.value
                ? "border border-[var(--accent)] bg-[var(--surface)]"
                : "border border-[var(--stroke)] bg-[var(--surface)]"
            } ${option.disabled ? "cursor-not-allowed opacity-60" : ""}`}
            onClick={() => !option.disabled && setPaymentMethod(option.value)}
            disabled={option.disabled}
          >
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 place-items-center rounded-[12px] font-semibold text-xs ${option.badgeClassName}`}>
                {option.badge}
              </span>
              <div>
                <p className="m-0 text-sm font-semibold">{option.label}</p>
                <p className="m-0 text-xs text-[var(--muted)]">{option.description}</p>
              </div>
            </div>
            <span
              className={`grid h-5 w-5 place-items-center rounded-full ${
                paymentMethod === option.value
                  ? "bg-[var(--accent)] text-[#0b1307]"
                  : "border border-[var(--stroke)]"
              }`}
            >
              {paymentMethod === option.value && (
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2l7 4v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z" />
          </svg>
          SSL Secure
        </div>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16v10H4z" />
            <path d="M9 7v10" />
          </svg>
          RAB Verified
        </div>
      </div>

      <p className="m-0 text-center text-[10px] text-[var(--muted)]">
        By clicking Confirm, you agree to the Escrow Protection terms and conditions for agricultural commerce in Rwanda.
      </p>

      <button
        className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.35)]"
        type="button"
        disabled={submitting}
        onClick={async () => {
          if (!selectedBatch) return;
          try {
            setSubmitting(true);
            setError(null);
            setNotice(null);
            const result = await createBuyerOrder({ batchId: selectedBatch.id, paymentMethod });
            setBuyerSelectedOrder(result.order);
            const checkoutResult = await createBuyerOrderCheckoutSession(result.order.id);
            setBuyerSelectedOrder(checkoutResult.order);

            if (checkoutResult.checkout.url) {
              window.location.assign(checkoutResult.checkout.url);
              return;
            }

            if (checkoutResult.checkout.kind === "mobile_money") {
              const msg =
                checkoutResult.checkout.message ||
                "Mobile money request was created. Complete payment on your phone.";
              setNotice(msg);
              onNavigate?.(`order-tracking?orderId=${checkoutResult.order.id}&checkout=mobile_money`);
              return;
            }

            throw new Error("No checkout redirect URL was returned");
          } catch (err) {
            console.error("Failed to create order", err);
            setError(err instanceof Error ? err.message : "Could not start the selected payment method right now.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting
          ? paymentMethod === "card"
            ? "Opening secure checkout..."
            : paymentMethod === "momo"
            ? "Requesting MTN Mobile Money..."
            : paymentMethod === "airtel"
              ? "Requesting Airtel Money..."
              : "Preparing payment..."
          : paymentMethod === "card"
            ? `Confirm & Pay by Card (${formatCurrency(quote.amountDueToday)})`
            : paymentMethod === "momo"
            ? `Confirm & Pay with MTN MoMo (${formatCurrency(quote.amountDueToday)})`
            : paymentMethod === "airtel"
              ? `Confirm & Pay with Airtel Money (${formatCurrency(quote.amountDueToday)})`
              : `Confirm Payment (${formatCurrency(quote.amountDueToday)})`}
      </button>
    </section>
  );
};

export default OrderReview;
