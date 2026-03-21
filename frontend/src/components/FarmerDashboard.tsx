import { useEffect, useState } from "react";
import type { ApiUser } from "../api/auth";
import { getDashboard, type Batch, type DashboardData } from "../api/farmer";
import type { ViewMode } from "../types";
import { getStoredUser } from "../utils/authStorage";

interface FarmerDashboardProps {
  onLogout?: () => void;
  onNavigate?: (view: ViewMode) => void;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatTrackingLabel = (stage: string) => {
  const labels: Record<string, string> = {
    awaiting_payment: "Awaiting payment",
    payment_confirmed: "Payment confirmed",
    farmer_dispatching: "Delivering to hub",
    hub_inspection: "Hub inspection",
    released_for_delivery: "Released for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[stage] || stage.replace(/_/g, " ");
};

const getBatchPrimaryImage = (batch: Batch) => {
  const firstProduct = batch.products?.[0]?.product;
  let imageUrl =
    typeof firstProduct === "object" && firstProduct !== null && "image" in firstProduct
      ? firstProduct.image
      : undefined;

  if (imageUrl && imageUrl.startsWith("/uploads")) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000";
    imageUrl = `${apiBase}${imageUrl}`;
  }

  return imageUrl || "https://placehold.co/100?text=Crop";
};

const getBatchPrimaryName = (batch: DashboardData["recentlySoldBatches"][number]) => {
  const product = batch.products?.[0]?.product;
  if (typeof product === "object" && product !== null && "name" in product) {
    return product.name;
  }
  return "Sold batch";
};

const FarmerDashboard = ({ onLogout, onNavigate }: FarmerDashboardProps) => {
  const storedUser = getStoredUser() as ApiUser | null;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (backgroundRefresh = false) => {
    if (!backgroundRefresh) {
      setLoading(true);
    }

    try {
      const result = await getDashboard();
      setData(result);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();

    const handleFocus = () => {
      void loadData(true);
    };

    const refreshTimer = window.setInterval(() => {
      void loadData(true);
    }, 15000);

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const fullName = data?.account.fullName || storedUser?.fullName || "Farmer";
  const phoneNumber = data?.account.phoneNumber || storedUser?.phoneNumber || "";
  const email = data?.account.email || "";
  const accountId = data?.account.id || "";

  if (loading) {
    return (
      <div className="app-screen app-screen-compact grid min-h-[40vh] place-items-center text-[var(--muted)]">
        <p className="animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <section className="app-screen app-screen-compact flex flex-col gap-6">
      <header className="app-page-header">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]">
              <span className="text-sm font-bold text-[var(--accent)]">{getInitials(fullName)}</span>
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]" />
          </div>
          <div>
            <p className="m-0 text-sm text-[var(--accent)]">Muraho!</p>
            <p className="m-0 text-lg font-semibold">{fullName}</p>
            <p className="m-0 text-xs text-[var(--muted)]">
              Signed in as {phoneNumber || "no phone"} {accountId ? `| ${accountId.slice(-6).toUpperCase()}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onLogout && (
            <button type="button" className="text-xs font-semibold text-[var(--muted)]" onClick={onLogout}>
              Log out
            </button>
          )}
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5 text-[var(--text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </button>
        </div>
      </header>

      <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">ACCOUNT CHECK</p>
            <p className="mt-2 mb-1 text-sm font-semibold">{fullName}</p>
            <p className="m-0 text-xs text-[var(--muted)]">
              {phoneNumber || "No phone number"} {email ? `| ${email}` : ""}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--surface-2)] px-3 py-2 text-right">
            <p className="m-0 text-[10px] font-semibold tracking-[2px] text-[var(--muted)]">FARMER ID</p>
            <p className="mt-1 mb-0 text-xs font-semibold text-[var(--accent)]">{accountId || "Unavailable"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--stroke)] bg-[linear-gradient(135deg,rgba(73,197,26,0.12),transparent)] p-5 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm font-semibold text-[var(--muted)]">Total Earnings</p>
          {data?.earningsChange && (
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {data.earningsChange}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold">{data?.totalEarnings?.toLocaleString() ?? 0}</span>
          <span className="text-sm font-semibold text-[var(--muted)]">RWF</span>
        </div>
        <p className="mt-3 mb-0 text-xs text-[var(--muted)]">
          Earnings reflect sold batches for this authenticated farmer account.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="flex items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307]"
            type="button"
            onClick={() => onNavigate?.("wallet")}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="18" height="12" rx="3" />
              <path d="M7 12h4" />
              <circle cx="16.5" cy="12" r="1.5" />
            </svg>
            Withdraw
          </button>
          <button className="flex items-center justify-center gap-2 rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 8v4l3 3" />
              <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
            History
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Orders In Progress</h3>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold text-[var(--muted)]">
          {data?.inProgressOrders.length ?? 0} active
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {(!data?.inProgressOrders || data.inProgressOrders.length === 0) && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5">
            <p className="m-0 text-sm font-semibold">No delivery orders in progress.</p>
            <p className="mt-2 mb-0 text-xs text-[var(--muted)]">
              Funded buyer orders will appear here and open directly into the delivery tracker.
            </p>
          </div>
        )}

        {data?.inProgressOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left shadow-sm transition-transform hover:scale-[1.01]"
            onClick={() => {
              if (order.batchId) {
                onNavigate?.(`batch-tracker/${order.batchId}`);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="m-0 text-sm font-semibold">{order.title}</h4>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase text-[var(--accent)]">
                    {formatTrackingLabel(order.trackingStage)}
                  </span>
                </div>
                <p className="mt-1 mb-0 text-xs text-[var(--muted)]">
                  {order.orderNumber || "Order"} • Buyer {order.buyerName}
                </p>
              </div>
              <div className="text-right">
                <p className="m-0 text-lg font-bold">
                  {order.totalPrice.toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">RWF</span>
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">{order.totalWeight.toLocaleString()} kg</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>{order.destination}</span>
              <span>
                {order.trackingUpdatedAt
                  ? `Updated ${new Date(order.trackingUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Awaiting update"}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          type="button"
          onClick={() => onNavigate?.("quality-scan")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16v10H4z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <p className="mt-4 mb-1 text-sm font-semibold">Scan Crop</p>
          <p className="m-0 text-xs text-[var(--muted)]">Instant crop health check</p>
        </button>
        <button
          className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          type="button"
          onClick={() => onNavigate?.("batch-creation")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </div>
          <p className="mt-4 mb-1 text-sm font-semibold">Add Harvest</p>
          <p className="m-0 text-xs text-[var(--muted)]">Log new produce batch</p>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Market Prices</h3>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold text-[var(--muted)]">
          Live
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {(!data?.marketPrices || data.marketPrices.length === 0) && (
          <p className="p-2 text-sm text-[var(--muted)]">Loading prices...</p>
        )}
        {data?.marketPrices.map((item) => (
          <div key={item.crop} className="min-w-[180px] rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs font-semibold text-[var(--muted)]">{item.crop}</p>
            <p className="mt-2 mb-1 text-lg font-semibold">
              {item.price}
              <span className="text-xs text-[var(--muted)]"> {item.unit}</span>
            </p>
            <p className={`m-0 text-xs font-semibold ${item.positive ? "text-[var(--accent)]" : "text-red-400"}`}>
              {item.change}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Recently Sold</h3>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold text-[var(--muted)]">
          {(data?.recentlySoldBatches || []).length} recent
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(!data?.recentlySoldBatches || data.recentlySoldBatches.length === 0) && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5 md:col-span-2">
            <p className="m-0 text-sm font-semibold">No sold batches yet.</p>
            <p className="mt-2 mb-0 text-xs text-[var(--muted)]">
              Completed sales will appear here and should match your earnings total.
            </p>
          </div>
        )}

        {data?.recentlySoldBatches.map((batch) => (
          <button
            key={batch.id}
            type="button"
            className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
            onClick={() => onNavigate?.(`batch-tracker/${batch.batchId}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm font-semibold">{getBatchPrimaryName(batch)}</p>
                <p className="mt-1 mb-0 text-xs text-[var(--muted)]">{batch.destination}</p>
              </div>
              <div className="text-right">
                <p className="m-0 text-base font-bold">
                  {batch.totalPrice.toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">RWF</span>
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">
                  {batch.soldAt ? `Sold ${new Date(batch.soldAt).toLocaleDateString()}` : "Marked sold"}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Active Batches</h3>
        <button className="text-xs font-semibold text-[var(--accent)]" type="button">
          View All
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(!data?.activeBatches || data.activeBatches.length === 0) && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface-2)] p-6 text-center md:col-span-2">
            <p className="text-sm text-[var(--muted)]">No active marketplace batches found.</p>
            <button
              onClick={() => onNavigate?.("batch-creation")}
              className="mt-2 text-xs font-semibold text-[var(--accent)]"
            >
              Create your first batch {"->"}
            </button>
          </div>
        )}

        {data?.activeBatches.map((batch) => (
          <button
            key={batch._id}
            type="button"
            className="cursor-pointer rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left shadow-sm transition-transform hover:scale-[1.02]"
            onClick={() => {
              onNavigate?.(`batch-tracker/${batch._id}`);
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="m-0 text-sm font-semibold">Active Batch</h4>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] uppercase text-[var(--accent)]">
                    {batch.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{new Date(batch.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="m-0 text-lg font-bold">
                  {(batch.totalPrice || 0).toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">RWF</span>
                </p>
                <p className="m-0 text-xs text-[var(--muted)]">{(batch.totalWeight || 0).toLocaleString()} kg</p>
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[12px] bg-[var(--surface-2)]">
                <img
                  src={getBatchPrimaryImage(batch)}
                  alt="Batch"
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/100?text=No+Image";
                  }}
                />
              </div>

              <div className="flex flex-col justify-center">
                {batch.products?.slice(0, 2).map((productEntry, index: number) => (
                  <div key={index} className="text-xs text-[var(--text)]">
                    <span className="font-semibold">
                      {typeof productEntry.product === "object" && productEntry.product !== null ? productEntry.product.name : "Crop"}
                    </span>
                    <span className="text-[var(--muted)]"> • {productEntry.quantity} kg</span>
                  </div>
                ))}
                {(batch.products?.length || 0) > 2 && (
                  <span className="text-[10px] text-[var(--muted)]">+{batch.products.length - 2} more</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="m-0 text-center text-xs text-[var(--muted)]">
        Last synced: {data?.lastSynced ? new Date(data.lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}
      </p>

      <nav className="app-bottom-nav mt-4 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          {
            label: "Home",
            active: true,
            target: "dashboard" as const,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 11l9-7 9 7" />
                <path d="M5 10v9h14v-9" />
              </svg>
            ),
          },
          {
            label: "Inventory",
            active: false,
            target: "inventory" as const,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 7h18v12H3z" />
                <path d="M3 11h18" />
                <path d="M9 7v12" />
              </svg>
            ),
          },
          {
            label: "Market",
            active: false,
            target: "market" as const,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 19V5" />
                <path d="M9 19V9" />
                <path d="M14 19v-6" />
                <path d="M19 19v-10" />
              </svg>
            ),
          },
          {
            label: "Profile",
            active: false,
            target: "profile" as const,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c2-4 14-4 16 0" />
              </svg>
            ),
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.target && onNavigate?.(item.target)}
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </section>
  );
};

export default FarmerDashboard;
