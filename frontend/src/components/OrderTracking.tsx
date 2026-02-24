import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getBuyerOrderById, releaseBuyerOrderEscrow, type BuyerOrderDetailResponse } from "../api/buyer";
import { API_BASE } from "../api/client";
import type { ViewMode } from "../types";
import { formatOrderReference, getBuyerSelectedOrder, setBuyerSelectedOrder } from "../utils/buyerCheckout";

interface OrderTrackingProps {
  onNavigate?: (view: ViewMode) => void;
}

const FALLBACK_IMAGE = "https://placehold.co/600x400?text=Order+Tracking";

const formatCurrency = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

const OrderTracking = ({ onNavigate }: OrderTrackingProps) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const orderIdFromQuery = searchParams.get("orderId");
  const checkoutState = searchParams.get("checkout");
  const selectedOrder = getBuyerSelectedOrder();
  const [data, setData] = useState<BuyerOrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(!!(selectedOrder?.id || orderIdFromQuery));
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const targetOrderId = selectedOrder?.id || orderIdFromQuery;

    if (!targetOrderId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadOrder = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBuyerOrderById(targetOrderId);
        if (cancelled) return;
        setData(result);
        setBuyerSelectedOrder(result.order);
      } catch (err) {
        console.error("Failed to load buyer order tracking", err);
        if (!cancelled) {
          setError("Unable to refresh order tracking. Showing saved order details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderIdFromQuery, selectedOrder?.id]);

  const order = data?.order || selectedOrder;
  const timeline = data?.timeline || [];
  const orderRef = order ? (order.orderNumber || formatOrderReference(order.id)) : "AG-ORDER";
  const canReleaseEscrow = !!order?.id && order.paymentStatus === "deposit_paid" && order.escrowStatus === "funded";

  if (!order) {
    return (
      <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
        <header className="flex items-center justify-between">
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
          <div className="text-center">
            <p className="m-0 text-base font-semibold">Order Tracking</p>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">No Active Order</p>
          </div>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>
        <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          No order selected. Confirm a marketplace order first to view tracking.
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("buyer-order-history")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-center">
          <p className="m-0 text-base font-semibold">Order #{orderRef}</p>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">Active Tracking</p>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Info"
        >
          <span className="text-sm font-semibold">i</span>
        </button>
      </header>

      {error && (
        <div className="rounded-[16px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      )}

      {checkoutState === "success" && (
        <div className="rounded-[16px] border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--accent)]">
          Stripe payment completed. Escrow deposit is being verified and tracking will update shortly.
        </div>
      )}

      {checkoutState === "cancelled" && (
        <div className="rounded-[16px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Stripe checkout was cancelled. Your order remains pending until the deposit is paid.
        </div>
      )}

      <div className="flex items-center gap-4 rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <img
          src={resolveImageUrl(order.image)}
          alt={order.title}
          className="h-16 w-16 rounded-[14px] object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        <div>
          <p className="m-0 text-sm font-semibold">
            {Math.round(order.totalWeight).toLocaleString()}kg {order.title}
          </p>
          <p className="mt-1 text-base font-semibold text-[var(--accent)]">{formatCurrency(order.totalPrice)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{order.destination}</p>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[linear-gradient(135deg,#0e2f12,#0f3d15)] p-5 text-white">
        <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-white/70">Estimated Arrival</p>
        <p className="mt-3 text-2xl font-semibold">
          {order.estimatedArrivalAt
            ? new Date(order.estimatedArrivalAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
            : "Pending"}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {order.estimatedArrivalAt
            ? `By ${new Date(order.estimatedArrivalAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "ETA will be updated after dispatch"}
        </p>
        <div className="mt-4 flex justify-end">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 13h13l3 3v3H3z" />
              <path d="M16 8h4l2 5" />
              <circle cx="7.5" cy="18.5" r="1.5" />
              <circle cx="16.5" cy="18.5" r="1.5" />
            </svg>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Delivery Progress</h3>
        <span className="text-xs text-[var(--muted)]">
          {loading ? "Refreshing..." : `Updated ${order.trackingUpdatedAt ? new Date(order.trackingUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}`}
        </span>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="relative flex flex-col gap-6">
          {timeline.map((step, index) => (
            <div key={step.key} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full ${
                    step.status === "done"
                      ? "bg-[var(--accent)] text-[#0b1307]"
                      : step.status === "active"
                        ? "bg-[var(--surface-2)] text-[var(--accent)]"
                        : "bg-[var(--surface-2)] text-[var(--muted)]"
                  }`}
                >
                  {step.status === "done" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  ) : step.status === "active" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="5" y="5" width="14" height="14" rx="3" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="6" width="16" height="12" rx="3" />
                    </svg>
                  )}
                </span>
                {index < timeline.length - 1 && (
                  <span className={`mt-2 h-12 w-1 rounded-full ${step.status === "done" ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"}`} />
                )}
              </div>
              <div className="flex-1">
                <p className={`m-0 text-sm font-semibold ${step.status === "active" ? "text-[var(--accent)]" : ""}`}>{step.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{step.time}</p>
                {step.detail && <p className="mt-2 text-xs text-[var(--muted)]">{step.detail}</p>}
                {step.status === "active" && (
                  <div className="mt-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted)]">
                    Tracking stage is active. The platform will update this timeline as the order moves through the hub and delivery steps.
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loading && timeline.length === 0 && (
            <div className="text-sm text-[var(--muted)]">No tracking updates yet.</div>
          )}
        </div>
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Route Map</h3>
      </div>
      <div className="overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
        <div className="relative h-44 w-full bg-[linear-gradient(135deg,#0f2312,#173a1f)]">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(73,197,26,0.35)_0,transparent_45%),radial-gradient(circle_at_80%_70%,rgba(73,197,26,0.25)_0,transparent_40%)]" />
          <div className="absolute left-6 top-7 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_0_4px_rgba(73,197,26,0.2)]" />
            <div className="text-xs">
              <p className="m-0 font-semibold text-white">Origin</p>
              <p className="m-0 text-white/70">{order.farmerName}</p>
            </div>
          </div>
          <div className="absolute right-6 bottom-8 flex items-center gap-3">
            <div className="text-right text-xs">
              <p className="m-0 font-semibold text-white">Hub / Destination</p>
              <p className="m-0 text-white/70">{order.destination}</p>
            </div>
            <span className="h-3 w-3 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.15)]" />
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 180" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M55 50 C 140 40, 170 135, 255 120 C 310 110, 315 95, 345 120"
              stroke="rgba(73,197,26,0.9)"
              strokeWidth="3"
              strokeDasharray="8 7"
              fill="none"
            />
          </svg>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="inline-flex rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted)]">
            {order.destination}
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.destination)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]"
          >
            Open in Maps
          </a>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold">
          Contact Support
        </button>
        <button
          className="flex-1 rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={!canReleaseEscrow || releasing}
          onClick={async () => {
            if (!order?.id || !canReleaseEscrow) return;
            try {
              setReleasing(true);
              setError(null);
              const result = await releaseBuyerOrderEscrow(order.id);
              setData(result);
              setBuyerSelectedOrder(result.order);
            } catch (err) {
              console.error("Failed to release escrow", err);
              setError("Could not release escrow. Ensure the farmer has a Stripe Connect account configured.");
            } finally {
              setReleasing(false);
            }
          }}
        >
          {order.escrowStatus === "released"
            ? "Escrow Released"
            : releasing
              ? "Releasing Escrow..."
              : canReleaseEscrow
                ? "Confirm Delivery & Release"
                : "Awaiting Payment / Delivery"}
        </button>
      </div>
    </section>
  );
};

export default OrderTracking;
