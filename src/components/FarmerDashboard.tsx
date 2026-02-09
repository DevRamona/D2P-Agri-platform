import type { ViewMode } from "../types";

interface FarmerDashboardProps {
  onLogout?: () => void;
  onNavigate?: (view: ViewMode) => void;
}

const FarmerDashboard = ({ onLogout, onNavigate }: FarmerDashboardProps) => {
  return (
    <section className="w-full max-w-[680px] flex flex-col gap-6 animate-[rise_0.6s_ease_both]">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-12 w-12 rounded-full bg-[var(--surface-2)] border border-[var(--stroke)] grid place-items-center">
              <span className="font-bold text-sm text-[var(--accent)]">MA</span>
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]" />
          </div>
          <div>
            <p className="m-0 text-sm text-[var(--accent)]">Muraho!</p>
            <p className="m-0 text-lg font-semibold">Mutesi Aline</p>
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
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            +12% vs last month
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold">450,000</span>
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
        {[
          { crop: "Arabica Coffee", price: "2,400", unit: "/kg", change: "+2.4%", positive: true },
          { crop: "Maize", price: "650", unit: "/kg", change: "-0.8%", positive: false },
          { crop: "Dry Beans", price: "900", unit: "/kg", change: "+1.1%", positive: true },
        ].map((item) => (
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
        <button
          type="button"
          onClick={() => onNavigate?.("batch-tracker")}
          className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-left"
          aria-label="Open batch tracker for Arabica batch"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-[14px] bg-[var(--surface-2)] grid place-items-center">
              <svg
                className="h-6 w-6 text-[var(--accent)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14c7 0 10-7 16-7 0 8-5 11-10 11-3 0-4-2-6-4z" />
                <path d="M9 15c1-3 4-5 8-6" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="m-0 text-xs font-semibold text-[var(--accent)]">Processing</p>
              <p className="m-0 text-sm font-semibold">Batch #402 - Arabica</p>
              <p className="m-0 text-xs text-[var(--muted)]">Last update: 2 hours ago</p>
            </div>
            <div className="text-right">
              <p className="m-0 text-sm font-semibold">850 kg</p>
              <p className="m-0 text-xs text-[var(--muted)]">Estimate</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-[var(--surface-2)]">
            <div className="h-2 w-[70%] rounded-full bg-[var(--accent)]" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold text-[var(--muted)]">
            <span>Washing</span>
            <span>Drying</span>
            <span className="text-[var(--accent)]">Milling</span>
            <span>Sale</span>
          </div>
        </button>

        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-[14px] bg-[var(--surface-2)] grid place-items-center">
              <svg
                className="h-6 w-6 text-amber-300"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 7h10v10H7z" />
                <path d="M7 11h10" />
                <path d="M10 7v10" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="m-0 text-xs font-semibold text-amber-300">In Transit</p>
              <p className="m-0 text-sm font-semibold">Batch #398 - Maize Bulk</p>
              <p className="m-0 text-xs text-[var(--muted)]">Headed to Kigali Processor</p>
            </div>
            <div className="text-right">
              <p className="m-0 text-sm font-semibold">1.2 t</p>
              <p className="m-0 text-xs text-[var(--muted)]">Confirmed</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-[var(--surface-2)]">
            <div className="h-2 w-[45%] rounded-full bg-amber-300" />
          </div>
        </div>
      </div>

      <p className="m-0 text-center text-xs text-[var(--muted)]">Last synced: Today, 08:45 AM</p>

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
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${
              item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
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
