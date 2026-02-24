import { useEffect, useState } from "react";
import { getWallet, type WalletActivity, type WalletData } from "../api/farmer";
import type { ViewMode } from "../types";

interface WalletProps {
  onNavigate?: (view: ViewMode) => void;
}

const formatAmount = (value: number) => Math.round(Number(value) || 0).toLocaleString();

const formatActivityDetail = (activity: WalletActivity) => {
  const timestamp = new Date(activity.occurredAt);
  const datePart = Number.isNaN(timestamp.getTime())
    ? "Unknown date"
    : timestamp.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timePart = Number.isNaN(timestamp.getTime())
    ? "--:--"
    : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart} · ${activity.reference}`;
};

const getStatusLabel = (status: WalletActivity["status"]) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    default:
      return status;
  }
};

const getStatusClass = (status: WalletActivity["status"]) => {
  switch (status) {
    case "completed":
      return "bg-[var(--accent-soft)] text-[var(--accent)]";
    case "processing":
      return "bg-amber-400/20 text-amber-300";
    case "failed":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-[var(--surface-2)] text-[var(--muted)]";
  }
};

const getIconKind = (activity: WalletActivity): "up" | "down" | "clock" => {
  if (activity.status === "processing") return "clock";
  return activity.direction === "debit" ? "down" : "up";
};

const Wallet = ({ onNavigate }: WalletProps) => {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getWallet();
        if (!cancelled) {
          setWallet(result);
        }
      } catch (err) {
        console.error("Failed to load wallet", err);
        if (!cancelled) {
          setError("Unable to load wallet data right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  const currency = wallet?.currency || "RWF";
  const recentActivity = wallet?.recentActivity || [];

  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
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
        <p className="m-0 text-base font-semibold">My Wallet</p>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Profile"
          onClick={() => onNavigate?.("profile")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c2-4 14-4 16 0" />
          </svg>
        </button>
      </header>

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-[24px] bg-[linear-gradient(135deg,var(--accent),#0f7f09)] p-5 text-white shadow-[0_16px_28px_rgba(73,197,26,0.35)]">
        <div className="flex items-center justify-between">
          <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-white/80">Total Available Balance</p>
          <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/20">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="4" y="6" width="16" height="12" rx="3" />
              <circle cx="16" cy="12" r="1.5" />
            </svg>
          </div>
        </div>
        <p className="mt-3 text-4xl font-bold">
          {loading ? "..." : formatAmount(wallet?.availableBalance || 0)}{" "}
          <span className="text-lg font-semibold">{currency}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Total Earned</p>
          <p className="mt-3 text-xl font-semibold text-[var(--accent)]">
            {loading ? "..." : formatAmount(wallet?.totalEarned || 0)} {currency}
          </p>
        </div>
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Pending Payout</p>
          <p className="mt-3 text-xl font-semibold text-amber-300">
            {loading ? "..." : formatAmount(wallet?.pendingPayout || 0)} {currency}
          </p>
        </div>
      </div>

      <button className="flex items-center justify-center gap-3 rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h16" />
          <path d="M6 4h12v16H6z" />
          <path d="M10 14h4" />
        </svg>
        Withdraw to Mobile Money
      </button>
      <p className="m-0 text-center text-xs font-semibold text-[var(--muted)]">MTN MOMO · Airtel MONEY</p>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-lg font-semibold">Recent Activity</h3>
        <button className="text-sm font-semibold text-[var(--accent)]" type="button" disabled={recentActivity.length === 0}>
          View All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {!loading && recentActivity.length === 0 && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No wallet activity yet. Completed and active batches will appear here.
          </div>
        )}

        {recentActivity.map((activity) => {
          const iconKind = getIconKind(activity);
          const amountPrefix = activity.direction === "debit" ? "-" : "+";
          const amountClass = activity.direction === "debit" ? "text-red-400" : "text-[var(--accent)]";

          return (
            <div key={activity.id} className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-12 w-12 place-items-center rounded-[16px] ${iconKind === "up"
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : iconKind === "down"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-amber-400/20 text-amber-300"
                      }`}
                  >
                    {iconKind === "up" && (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 19V5" />
                        <path d="M6 11l6-6 6 6" />
                      </svg>
                    )}
                    {iconKind === "down" && (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 5v14" />
                        <path d="M18 13l-6 6-6-6" />
                      </svg>
                    )}
                    {iconKind === "clock" && (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v6l4 2" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <p className="m-0 text-sm font-semibold">{activity.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{formatActivityDetail(activity)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`m-0 text-base font-semibold ${amountClass}`}>
                    {amountPrefix}
                    {formatAmount(activity.amount)}
                  </p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusClass(activity.status)}`}>
                    {getStatusLabel(activity.status)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="m-0 text-center text-xs text-[var(--muted)]">
        Last synced:{" "}
        {wallet?.lastSynced
          ? new Date(wallet.lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "--:--"}
      </p>

      <nav className="mt-2 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Home", active: false, target: "dashboard" as const },
          { label: "Inventory", active: false, target: "inventory" as const },
          { label: "Wallet", active: true, target: "wallet" as const },
          { label: "Profile", active: false, target: "profile" as const },
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
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v9h14v-9" />
                </svg>
              )}
              {item.label === "Inventory" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 7h18v12H3z" />
                  <path d="M3 11h18" />
                  <path d="M9 7v12" />
                </svg>
              )}
              {item.label === "Wallet" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="6" width="18" height="12" rx="3" />
                  <circle cx="16.5" cy="12" r="1.5" />
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

export default Wallet;
