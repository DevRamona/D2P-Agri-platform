import { useEffect, useState } from "react";
import type { ApiUser } from "../api/auth";
import { getDashboard, getWallet, type DashboardData, type WalletActivity, type WalletData } from "../api/farmer";
import type { ViewMode } from "../types";
import { getStoredUser } from "../utils/authStorage";

interface FarmerProfileProps {
  onNavigate?: (view: ViewMode) => void;
  onLogout?: () => void;
}

const formatAmount = (value: number, currency = "RWF") =>
  `${Math.round(Number(value) || 0).toLocaleString()} ${currency}`;

const formatDate = (value?: string) => {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const formatTime = (value?: string) => {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatActivitySubtext = (activity: WalletActivity) => {
  return `${formatDate(activity.occurredAt)} · ${formatTime(activity.occurredAt)} · ${activity.reference}`;
};

const profileStatusClass = (status: WalletActivity["status"]) => {
  if (status === "completed") return "bg-[var(--accent-soft)] text-[var(--accent)]";
  if (status === "processing") return "bg-amber-400/20 text-amber-300";
  return "bg-red-500/15 text-red-400";
};

const profileStatusLabel = (status: WalletActivity["status"]) => {
  if (status === "completed") return "Completed";
  if (status === "processing") return "Processing";
  return "Failed";
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const FarmerProfile = ({ onNavigate, onLogout }: FarmerProfileProps) => {
  const user = getStoredUser() as ApiUser | null;
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfileData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [walletData, dashboardData] = await Promise.all([
          getWallet(),
          getDashboard(),
        ]);

        if (cancelled) return;
        setWallet(walletData);
        setDashboard(dashboardData);
      } catch (err) {
        console.error("Failed to load farmer profile data", err);
        if (!cancelled) {
          setError("Unable to load profile details right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfileData();
    return () => {
      cancelled = true;
    };
  }, []);

  const fullName = user?.fullName || "Farmer";
  const phoneNumber = user?.phoneNumber || "Not available";
  const roleLabel = user?.role ? user.role.replace("_", " ") : "FARMER";
  const walletPreview = wallet?.recentActivity?.slice(0, 3) || [];
  const currency = wallet?.currency || "RWF";

  return (
    <section className="w-full max-w-[680px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("dashboard")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">Farmer Profile</p>
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
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-[24px] border border-[var(--stroke)] bg-[linear-gradient(135deg,rgba(73,197,26,0.14),rgba(73,197,26,0.03))] p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] text-lg font-bold text-[var(--accent)]">
              {getInitials(fullName)}
            </div>
            <div>
              <p className="m-0 text-lg font-semibold">{fullName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">
                  {roleLabel}
                </span>
                <span className="text-xs text-[var(--muted)]">Member since {formatDate(user?.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
            onClick={() => onNavigate?.("wallet")}
          >
            Open Wallet
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs font-semibold tracking-[1.5px] text-[var(--muted)] uppercase">Phone Number</p>
            <p className="mt-2 text-sm font-semibold">{phoneNumber}</p>
          </div>
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs font-semibold tracking-[1.5px] text-[var(--muted)] uppercase">Farmer ID</p>
            <p className="mt-2 text-sm font-semibold">{user?.id ? `#${user.id.slice(-8).toUpperCase()}` : "Not available"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Available Balance</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--accent)]">
            {loading ? "..." : formatAmount(wallet?.availableBalance || 0, currency)}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">From completed payouts (withdrawals ledger not yet enabled)</p>
        </div>
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Pending Payout</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">
            {loading ? "..." : formatAmount(wallet?.pendingPayout || 0, currency)}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">Estimated from active batches in progress</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs text-[var(--muted)]">Total Earned</p>
          <p className="mt-2 text-lg font-semibold">{loading ? "..." : formatAmount(wallet?.totalEarned || 0, currency)}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs text-[var(--muted)]">Active Batches</p>
          <p className="mt-2 text-lg font-semibold">{loading ? "..." : (dashboard?.activeBatches?.length ?? 0)}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs text-[var(--muted)]">Last Sync</p>
          <p className="mt-2 text-lg font-semibold">{loading ? "..." : formatTime(wallet?.lastSynced || dashboard?.lastSynced)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Wallet Activity Preview</h3>
        <button className="text-xs font-semibold text-[var(--accent)]" type="button" onClick={() => onNavigate?.("wallet")}>
          View Wallet
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {!loading && walletPreview.length === 0 && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] p-5 text-sm text-[var(--muted)]">
            No wallet activity yet. Your batch payouts and pending batch payments will appear here.
          </div>
        )}

        {walletPreview.map((activity) => {
          const amountClass = activity.direction === "debit" ? "text-red-400" : "text-[var(--accent)]";
          const amountPrefix = activity.direction === "debit" ? "-" : "+";

          return (
            <div key={activity.id} className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-semibold">{activity.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{formatActivitySubtext(activity)}</p>
                </div>
                <div className="text-right">
                  <p className={`m-0 text-sm font-semibold ${amountClass}`}>
                    {amountPrefix}
                    {Math.round(activity.amount).toLocaleString()} {currency}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${profileStatusClass(activity.status)}`}>
                    {profileStatusLabel(activity.status)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
          onClick={() => onNavigate?.("inventory")}
        >
          <p className="m-0 text-sm font-semibold">Manage Inventory</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Update products, quantities, and prices</p>
        </button>
        <button
          type="button"
          className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
          onClick={() => onNavigate?.("quality-scan")}
        >
          <p className="m-0 text-sm font-semibold">Crop Quality Scan</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Run disease checks and request recommendations</p>
        </button>
      </div>

      <nav className="mt-2 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Home", active: false, target: "dashboard" as const },
          { label: "Inventory", active: false, target: "inventory" as const },
          { label: "Wallet", active: false, target: "wallet" as const },
          { label: "Profile", active: true, target: "profile" as const },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.target)}
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.label === "Home" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v9h14v-9" />
                </svg>
              )}
              {item.label === "Inventory" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 7h18v12H3z" />
                  <path d="M3 11h18" />
                  <path d="M9 7v12" />
                </svg>
              )}
              {item.label === "Wallet" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="6" width="18" height="12" rx="3" />
                  <circle cx="16.5" cy="12" r="1.5" />
                </svg>
              )}
              {item.label === "Profile" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
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

export default FarmerProfile;
