import { useEffect, useState } from "react";
import type { ViewMode } from "../types";
import { getStoredUser } from "../utils/authStorage";
import type { ApiUser } from "../api/auth";
import { getDashboard, type DashboardData } from "../api/farmer";

interface FarmerDashboardProps {
  onLogout?: () => void;
  onNavigate?: (view: ViewMode) => void;
}

const FarmerDashboard = ({ onLogout, onNavigate }: FarmerDashboardProps) => {
  const user = getStoredUser() as ApiUser | null;
  const fullName = user?.fullName || "Farmer";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getDashboard();
        setData(result as unknown as DashboardData);
      } catch (err) {
        console.error("Failed to load dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="w-full max-w-[680px] h-screen grid place-items-center text-[var(--muted)]">
        <p className="animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <section className="w-full max-w-[680px] flex flex-col gap-6 animate-[rise_0.6s_ease_both]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] border border-[var(--stroke)] grid place-items-center">
              <span className="font-bold text-sm text-[var(--accent)]">{getInitials(fullName)}</span>
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]" />
          </div>
          <div>
            <p className="m-0 text-sm text-[var(--accent)]">Muraho!</p>
            <p className="m-0 text-lg font-semibold">{fullName}</p>
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
            className="h-11 w-11 rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] grid place-items-center"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5 text-[var(--text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </button>
        </div>
      </header>

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
          <p className="text-sm text-[var(--muted)] p-2">Loading prices...</p>
        )}
        {data?.marketPrices.map((item) => (
          <div
            key={item.crop}
            className="min-w-[180px] rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4"
          >
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
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Active Batches</h3>
        <button className="text-xs font-semibold text-[var(--accent)]" type="button">
          View All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {(!data?.activeBatches || data.activeBatches.length === 0) && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface-2)] p-6 text-center">
            <p className="text-sm text-[var(--muted)]">No active batches found.</p>
            <button onClick={() => onNavigate?.("batch-creation")} className="mt-2 text-xs font-semibold text-[var(--accent)]">Create your first batch →</button>
          </div>
        )}

        {data?.activeBatches.map((batch: any) => (
          <div key={batch.id}>Batch</div>
        ))}
      </div>

      <p className="m-0 text-center text-xs text-[var(--muted)]">
        Last synced: {data?.lastSynced ? new Date(data.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
      </p>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          {
            label: "Home",
            active: true,
            target: "farmer-dashboard" as const,
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
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
    </section>
  );
};

export default FarmerDashboard;
