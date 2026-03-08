import { useEffect, useMemo, useState } from "react";
import { getBuyerOrders, type BuyerOrder, type BuyerOrderHistoryData } from "../api/buyer";
import { API_BASE } from "../api/client";
import type { ViewMode } from "../types";
import { setBuyerSelectedOrder } from "../utils/buyerCheckout";

interface BuyerOrderHistoryProps {
  onNavigate?: (view: ViewMode) => void;
}

const FALLBACK_IMAGE = "https://placehold.co/600x400?text=Order";

const formatCurrency = (value: number) => Math.round(Number(value) || 0).toLocaleString();

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

const STATUS_TABS = [
  { key: "all", label: "All Orders" },
  { key: "completed", label: "Completed" },
  { key: "in_progress", label: "In Progress" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const orderStatusBadge = (order: BuyerOrder) => {
  if (order.paymentStatus !== "deposit_paid") {
    return { label: "Pending Payment", className: "bg-sky-400/15 text-sky-300" };
  }
  if (order.status === "completed") {
    return { label: "100% Done", className: "bg-[var(--accent-soft)] text-[var(--accent)]" };
  }
  if (order.status === "cancelled") {
    return { label: "Cancelled", className: "bg-red-500/15 text-red-400" };
  }
  return { label: "In Progress", className: "bg-amber-400/15 text-amber-300" };
};

const BuyerOrderHistory = ({ onNavigate }: BuyerOrderHistoryProps) => {
  const [activeTab, setActiveTab] = useState<(typeof STATUS_TABS)[number]["key"]>("all");
  const [data, setData] = useState<BuyerOrderHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBuyerOrders({ status: activeTab });
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        console.error("Failed to load buyer order history", err);
        if (!cancelled) {
          setError("Unable to load order history right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const orders = data?.orders || [];
  const totals = data?.totals;

  const navCounts = useMemo(() => {
    return {
      all: totals?.totalOrders ?? 0,
      completed: totals?.completedOrders ?? 0,
      in_progress: totals?.activeOrders ?? 0,
      cancelled: totals?.cancelledOrders ?? 0,
    };
  }, [totals]);

  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-10">
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
        <div>
          <p className="m-0 text-base font-semibold">Order History</p>
          <p className="m-0 text-xs text-[var(--accent)]">Commercial Buyer Account</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Filter"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16" />
              <path d="M8 12h8" />
              <path d="M10 18h4" />
            </svg>
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-6 border-b border-[var(--stroke)] pb-3 text-sm font-semibold overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2 whitespace-nowrap ${
              activeTab === tab.key ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {tab.label}{" "}
            <span className="text-[10px]">({navCounts[tab.key]})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Spent</p>
          <p className="mt-3 text-xl font-semibold">
            {loading ? "..." : formatCurrency(totals?.totalSpent || 0)} <span className="text-sm text-[var(--muted)]">RWF</span>
          </p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Volume</p>
          <p className="mt-3 text-xl font-semibold">
            {loading ? "..." : formatCurrency(totals?.totalVolume || 0)} <span className="text-sm text-[var(--muted)]">KG</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {loading && (
          <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Loading orders...
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            No orders found for this filter.
          </div>
        )}

        {orders.map((order) => {
          const badge = orderStatusBadge(order);
          return (
            <div key={order.id} className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
              <div className="flex gap-4 p-4">
                <img
                  src={resolveImageUrl(order.image)}
                  alt={order.title}
                  className="h-20 w-20 rounded-[16px] object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="m-0 text-xs font-semibold text-[var(--accent)]">Order #{order.orderNumber}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold">{order.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{order.farmerName}</p>
                  <p className="mt-3 text-base font-semibold">
                    {formatCurrency(order.totalPrice)} <span className="text-xs text-[var(--muted)]">RWF</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] px-4 py-3 text-xs text-[var(--muted)]">
                <span>
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "--"} · {formatCurrency(order.pricePerKg)} RWF/kg
                </span>
                <div className="flex gap-2">
                  <button
                    className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]"
                    onClick={() => {
                      setBuyerSelectedOrder(order);
                      onNavigate?.("order-tracking");
                    }}
                    type="button"
                  >
                    Track
                  </button>
                  <button className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
                    Receipt
                  </button>
                  <button className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
                    Share
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-6 sm:right-10 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.4)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Batch Export
      </button>

      <nav className="mt-4 grid grid-cols-5 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Home", active: false, target: "buyer-marketplace" as const },
          { label: "Browse", active: false, target: "buyer-marketplace" as const },
          { label: "Active", active: false, target: "order-tracking" as const },
          { label: "History", active: true, target: "buyer-order-history" as const },
          { label: "Profile", active: false, target: "buyer-profile" as const },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.target && onNavigate?.(item.target)}
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${
              item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.label === "Home" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v9h14v-9" />
                </svg>
              )}
              {item.label === "Browse" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v4" />
                  <path d="M12 18v4" />
                  <path d="M2 12h4" />
                  <path d="M18 12h4" />
                </svg>
              )}
              {item.label === "Active" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 7h16v10H4z" />
                  <path d="M4 11h16" />
                </svg>
              )}
              {item.label === "History" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16" />
                  <path d="M4 12h10" />
                  <path d="M4 18h8" />
                </svg>
              )}
              {item.label === "Profile" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c2-4 14-4 16 0" />
                </svg>
              )}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </section>
  );
};

export default BuyerOrderHistory;
