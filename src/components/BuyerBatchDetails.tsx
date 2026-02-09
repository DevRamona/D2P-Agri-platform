import type { ViewMode } from "../types";

interface BuyerBatchDetailsProps {
  onNavigate?: (view: ViewMode) => void;
}

const metrics = [
  { label: "Ripeness (Dry Matter)", value: "24.5%", note: "Optimal range", color: "bg-[var(--accent)]" },
  { label: "Moisture Levels", value: "72%", note: "Balanced", color: "bg-sky-400" },
  { label: "Avg. Weight / Fruit", value: "245 g", note: "Consistent sizing", color: "bg-[var(--accent)]" },
  { label: "Pest Detection", value: "0 Hits", note: "RICA certified", color: "bg-[var(--accent)]" },
];

const BuyerBatchDetails = ({ onNavigate }: BuyerBatchDetailsProps) => {
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
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">Verified Batch</p>
          <p className="m-0 text-base font-semibold">Hass Avocados #442</p>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Share"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="18" cy="5" r="2" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="18" cy="19" r="2" />
            <path d="M8 12l8-5" />
            <path d="M8 12l8 5" />
          </svg>
        </button>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold">AI Diagnostics Visuals</h2>
        <span className="text-xs font-semibold text-[var(--muted)]">3 Scans Available</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        <div className="min-w-[260px] overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1524593656068-fbac72624bb0?auto=format&fit=crop&w=800&q=80"
              alt=""
              className="h-36 w-full object-cover"
            />
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
              Original
            </span>
          </div>
          <div className="p-3">
            <p className="m-0 text-sm font-semibold">Original Scan</p>
          </div>
        </div>
        <div className="min-w-[120px] overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
          <div className="h-36 bg-[linear-gradient(135deg,#2fa86e,#0b3f2f)]" />
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-sm font-semibold">Overall Health Quality</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Excellent uniformity with negligible skin defects. Ready for export.
            </p>
          </div>
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-[conic-gradient(var(--accent)_0deg,var(--accent)_320deg,rgba(255,255,255,0.1)_320deg)]">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface)]">
              <span className="text-lg font-bold">98%</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-[#0b1307]">Grade A</span>
          <span className="text-xs font-semibold text-[var(--accent)]">+2.4% above regional avg</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[var(--surface-2)] text-[var(--accent)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </span>
        Detailed Analysis
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          >
            <p className="m-0 text-xs text-[var(--muted)]">{metric.label}</p>
            <p className="mt-2 text-xl font-semibold">{metric.value}</p>
            <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-2)]">
              <div className={`h-2 w-[70%] rounded-full ${metric.color}`} />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{metric.note}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Provenance &amp; Source</h3>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
        <div className="h-28 bg-[linear-gradient(135deg,#40454d,#6e7682)] relative">
          <span className="absolute right-20 top-8 h-4 w-4 rounded-full border-4 border-[var(--accent)] bg-transparent" />
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 19V5h16v14" />
                <path d="M8 19V9h8v10" />
              </svg>
            </span>
            <div>
              <p className="m-0 text-xs text-[var(--muted)]">Aggregation Hub</p>
              <p className="m-0 text-sm font-semibold">Musanze Northern Hub, Sector 4</p>
              <p className="m-0 text-xs text-[var(--muted)]">Contact: Jean-Claude B. (Manager)</p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4" />
                <path d="M16 3v4" />
              </svg>
            </span>
            <div>
              <p className="m-0 text-xs text-[var(--muted)]">Harvest Timeline</p>
              <p className="m-0 text-sm font-semibold">Harvested 48h ago</p>
              <p className="m-0 text-xs text-[var(--muted)]">Exp. Shelf Life: 12-14 Days</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold">
          Contact
        </button>
        <button className="flex-[2] rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
          Add 1.2 Tons to Order
        </button>
      </div>
    </section>
  );
};

export default BuyerBatchDetails;
