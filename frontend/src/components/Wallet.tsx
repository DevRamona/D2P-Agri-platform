import type { ViewMode } from "../types";

interface WalletProps {
  onNavigate?: (view: ViewMode) => void;
}

const activities = [
  {
    title: "Irish Potatoes Sale",
    detail: "Oct 24 · 14:20 · Order #8821",
    amount: "+45,000",
    status: "Completed",
    statusClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    icon: "up",
  },
  {
    title: "MTN MoMo Withdrawal",
    detail: "Oct 22 · 09:15 · Ref: 98124",
    amount: "-25,000",
    status: "Success",
    statusClass: "bg-[var(--surface-2)] text-[var(--muted)]",
    icon: "down",
  },
  {
    title: "Organic Beans Payout",
    detail: "Oct 20 · 16:45 · Order #8701",
    amount: "+12,200",
    status: "Completed",
    statusClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    icon: "up",
  },
  {
    title: "Maize Delivery Payment",
    detail: "Oct 19 · 11:30 · In Review",
    amount: "+8,500",
    status: "Processing",
    statusClass: "bg-amber-400/20 text-amber-300",
    icon: "clock",
  },
];

const Wallet = ({ onNavigate }: WalletProps) => {
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
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c2-4 14-4 16 0" />
          </svg>
        </button>
      </header>

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
        <p className="mt-3 text-4xl font-bold">150,000 <span className="text-lg font-semibold">RWF</span></p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Total Earned</p>
          <p className="mt-3 text-xl font-semibold text-[var(--accent)]">420,000 RWF</p>
        </div>
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm text-[var(--muted)]">Pending Payout</p>
          <p className="mt-3 text-xl font-semibold text-amber-300">12,500 RWF</p>
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
        <button className="text-sm font-semibold text-[var(--accent)]" type="button">
          View All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {activities.map((activity) => (
          <div key={activity.title} className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-12 w-12 place-items-center rounded-[16px] ${activity.icon === "up"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : activity.icon === "down"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-400/20 text-amber-300"
                    }`}
                >
                  {activity.icon === "up" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 5v14" />
                      <path d="M6 11l6-6 6 6" />
                    </svg>
                  )}
                  {activity.icon === "down" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M12 19V5" />
                      <path d="M18 13l-6 6-6-6" />
                    </svg>
                  )}
                  {activity.icon === "clock" && (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v6l4 2" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="m-0 text-sm font-semibold">{activity.title}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{activity.detail}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`m-0 text-base font-semibold ${activity.amount.startsWith("-") ? "text-red-400" : "text-[var(--accent)]"
                    }`}
                >
                  {activity.amount}
                </p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${activity.statusClass}`}>
                  {activity.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <nav className="mt-2 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Market", active: false },
          { label: "My Crops", active: false },
          { label: "Wallet", active: true },
          { label: "Settings", active: false },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.label === "Market" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 9h18" />
                  <path d="M4 9l2 11h12l2-11" />
                  <path d="M7 9V6h10v3" />
                </svg>
              )}
              {item.label === "My Crops" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3v18" />
                  <path d="M6 12h12" />
                </svg>
              )}
              {item.label === "Wallet" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="6" width="18" height="12" rx="3" />
                  <circle cx="16.5" cy="12" r="1.5" />
                </svg>
              )}
              {item.label === "Settings" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 8a4 4 0 1 0 0 8" />
                  <path d="M19.4 15a7.8 7.8 0 0 0 0-6" />
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
