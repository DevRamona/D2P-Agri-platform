import { useEffect, useState } from "react";
import { getBuyerProfile, type BuyerProfileData } from "../api/buyer";
import { API_BASE } from "../api/client";
import type { ViewMode } from "../types";
import { setBuyerSelectedOrder } from "../utils/buyerCheckout";
import { getStoredUser } from "../utils/authStorage";
import type { ApiUser } from "../api/auth";

interface BuyerProfileProps {
  onNavigate?: (view: ViewMode) => void;
  onLogout?: () => void;
}

const FALLBACK_IMAGE = "https://placehold.co/400x240?text=Order";

const formatCurrency = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const BuyerProfile = ({ onNavigate, onLogout }: BuyerProfileProps) => {
  const storedUser = getStoredUser() as ApiUser | null;
  const [data, setData] = useState<BuyerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getBuyerProfile();
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Failed to load buyer profile", err);
        if (!cancelled) setError("Unable to load buyer profile data right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const buyer = data?.buyer || {
    id: storedUser?.id || "",
    fullName: storedUser?.fullName || "Buyer",
    phoneNumber: storedUser?.phoneNumber || "",
    email: "",
    role: storedUser?.role || "BUYER",
    createdAt: storedUser?.createdAt || null,
  };
  const summary = data?.summary;
  const recentOrders = data?.recentOrders || [];

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
        <div className="text-center">
          <p className="m-0 text-base font-semibold">Buyer Profile</p>
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">Commercial Account</p>
        </div>
        {onLogout ? (
          <button
            type="button"
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
            onClick={onLogout}
          >
            Log out
          </button>
        ) : (
          <span className="w-10" aria-hidden="true" />
        )}
      </header>

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="rounded-[24px] border border-[var(--stroke)] bg-[linear-gradient(135deg,rgba(73,197,26,0.15),rgba(73,197,26,0.04))] p-5 shadow-[var(--shadow)]">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] text-lg font-bold text-[var(--accent)]">
            {getInitials(buyer.fullName)}
          </div>
          <div className="min-w-0">
            <p className="m-0 text-base font-semibold truncate">{buyer.fullName}</p>
            <p className="m-0 mt-1 text-xs text-[var(--muted)] truncate">{buyer.phoneNumber || "No phone number"}</p>
            {buyer.email && <p className="m-0 mt-1 text-xs text-[var(--muted)] truncate">{buyer.email}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface)] p-3">
            <p className="m-0 text-[var(--muted)]">Member Since</p>
            <p className="mt-1 font-semibold">
              {buyer.createdAt ? new Date(buyer.createdAt).toLocaleDateString() : "--"}
            </p>
          </div>
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface)] p-3">
            <p className="m-0 text-[var(--muted)]">Buyer ID</p>
            <p className="mt-1 font-semibold">#{buyer.id ? buyer.id.slice(-8).toUpperCase() : "N/A"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Spent</p>
          <p className="mt-3 text-xl font-semibold">{loading ? "..." : formatCurrency(summary?.totalSpent || 0)}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Volume</p>
          <p className="mt-3 text-xl font-semibold">
            {loading ? "..." : `${Math.round(summary?.totalVolume || 0).toLocaleString()} KG`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-3 text-center">
          <p className="m-0 text-[10px] uppercase tracking-[1.5px] text-[var(--muted)]">Orders</p>
          <p className="mt-2 text-lg font-semibold">{loading ? "..." : summary?.totalOrders ?? 0}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-3 text-center">
          <p className="m-0 text-[10px] uppercase tracking-[1.5px] text-[var(--muted)]">Active</p>
          <p className="mt-2 text-lg font-semibold text-amber-300">{loading ? "..." : summary?.activeOrders ?? 0}</p>
        </div>
        <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-3 text-center">
          <p className="m-0 text-[10px] uppercase tracking-[1.5px] text-[var(--muted)]">Avg Order</p>
          <p className="mt-2 text-sm font-semibold">{loading ? "..." : formatCurrency(summary?.averageOrderValue || 0)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Recent Orders</h3>
        <button className="text-xs font-semibold text-[var(--accent)]" type="button" onClick={() => onNavigate?.("buyer-order-history")}>
          View All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {!loading && recentOrders.length === 0 && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            No orders yet. Browse the marketplace to place your first order.
          </div>
        )}

        {recentOrders.map((order) => (
          <div key={order.id} className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <div className="flex gap-3">
              <img
                src={resolveImageUrl(order.image)}
                alt={order.title}
                className="h-16 w-16 rounded-[14px] object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-xs font-semibold text-[var(--accent)] truncate">#{order.orderNumber}</p>
                <p className="mt-1 text-sm font-semibold truncate">{order.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)] truncate">{order.farmerName}</p>
                <p className="mt-2 text-sm font-semibold">{formatCurrency(order.totalPrice)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="m-0 text-xs text-[var(--muted)]">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "--"} · {Math.round(order.totalWeight).toLocaleString()}kg
              </p>
              <button
                type="button"
                className="rounded-[12px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#0b1307]"
                onClick={() => {
                  setBuyerSelectedOrder(order);
                  onNavigate?.("order-tracking");
                }}
              >
                Track Order
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
          onClick={() => onNavigate?.("buyer-marketplace")}
        >
          <p className="m-0 text-sm font-semibold">Browse Marketplace</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Find farmer batches and compare offers</p>
        </button>
        <button
          type="button"
          className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
          onClick={() => onNavigate?.("buyer-order-history")}
        >
          <p className="m-0 text-sm font-semibold">Order History</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Review receipts and track previous orders</p>
        </button>
      </div>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Discover", active: false, target: "buyer-marketplace" as const },
          { label: "Orders", active: false, target: "buyer-order-history" as const },
          { label: "Bids", active: false },
          { label: "Profile", active: true, target: "buyer-profile" as const },
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
              {item.label === "Discover" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4h7v7H4z" />
                  <path d="M13 4h7v7h-7z" />
                  <path d="M4 13h7v7H4z" />
                  <path d="M13 13h7v7h-7z" />
                </svg>
              )}
              {item.label === "Orders" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 7h16v12H4z" />
                  <path d="M4 11h16" />
                </svg>
              )}
              {item.label === "Bids" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 20V4" />
                  <path d="M8 20V10" />
                  <path d="M12 20V6" />
                  <path d="M16 20V14" />
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

export default BuyerProfile;
