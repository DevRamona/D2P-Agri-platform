import type { ViewMode } from "../types";

interface BatchTrackerProps {
  onNavigate?: (view: ViewMode) => void;
}

const BatchTracker = ({ onNavigate }: BatchTrackerProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("farmer-dashboard")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">Batch #2049 Tracker</p>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Help"
        >
          <span className="text-sm font-semibold">?</span>
        </button>
      </header>

      <div className="rounded-[22px] bg-[var(--accent)] p-5 text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
        <div className="flex items-center justify-between">
          <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-[#0b1307]/80">Total Contract Value</p>
          <span className="rounded-full bg-black/15 px-3 py-1 text-xs font-semibold">Maize</span>
        </div>
        <p className="mt-3 text-3xl font-bold">850,000 RWF</p>
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
            <path d="M9 9h6" />
          </svg>
          Kigali Central Hub
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-lg font-semibold">Payment Progress</h3>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
          60% Released
        </span>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="relative flex gap-4">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12l4 4 10-10" />
              </svg>
            </div>
            <span className="mt-2 h-20 w-1 rounded-full bg-[var(--accent)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="m-0 text-sm font-semibold">60% Advance Payment</p>
              <span className="text-xs font-semibold text-[var(--accent)]">Received</span>
            </div>
            <p className="mt-2 text-2xl font-bold">510,000 RWF</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Transferred to Mobile Money</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4" />
                <path d="M16 3v4" />
              </svg>
              Oct 12, 2023 · 14:30
            </div>
          </div>
        </div>

        <div className="mt-6 relative flex gap-4">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6l3 3" />
              </svg>
            </div>
            <span className="mt-2 h-20 w-1 rounded-full bg-[var(--surface-2)]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="m-0 text-sm font-semibold">40% Quality Retention</p>
              <span className="text-xs font-semibold text-amber-300">Pending Hub</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--muted)]">340,000 RWF</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Held in secure escrow account</p>
            <div className="mt-4 rounded-[16px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
              Funds will be released upon completion of moisture content and quality validation (Expected Oct 15).
            </div>
          </div>
        </div>

        <div className="mt-6 relative flex gap-4 opacity-60">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 6v6l4 2" />
                <path d="M12 2a10 10 0 1 0 10 10" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <p className="m-0 text-sm font-semibold">Payout Completion</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Batch settlement finalized</p>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between">
          <p className="m-0 text-sm font-semibold">Escrow Release Status</p>
          <span className="text-lg font-bold text-[var(--accent)]">60%</span>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-[var(--surface-2)]">
          <div className="h-3 w-[60%] rounded-full bg-[var(--accent)]" />
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">510,000 RWF of 850,000 RWF released</p>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[linear-gradient(140deg,#0f1c36,rgba(15,28,54,0.35))] p-5 text-white">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between text-white/70">
            <span>Batch ID</span>
            <span className="text-white">#2049-RW-MZ</span>
          </div>
          <div className="flex items-center justify-between text-white/70">
            <span>Quantity Delivered</span>
            <span className="text-white">2,500 KG</span>
          </div>
          <div className="flex items-center justify-between text-white/70">
            <span>Inspection Status</span>
            <span className="text-[var(--accent)]">In Progress</span>
          </div>
        </div>
      </div>

      <button className="w-full rounded-[16px] bg-white px-4 py-4 text-sm font-semibold text-[#0b1307] shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
        Contact Support for Batch #2049
      </button>
    </section>
  );
};

export default BatchTracker;
