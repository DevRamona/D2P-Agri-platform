import type { ViewMode } from "../types";

interface AIDiagnosisProps {
  onNavigate?: (view: ViewMode) => void;
}

const metrics = [
  { label: "Leaf Color", value: "Normal Green", icon: "palette" },
  { label: "Stem Integrity", value: "Strong/Stable", icon: "arrow" },
  { label: "Hydration", value: "Optimal Level", icon: "drop" },
  { label: "Pest Activity", value: "None Detected", icon: "bug" },
];

const AIDiagnosis = ({ onNavigate }: AIDiagnosisProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("quality-scan")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">AI Diagnosis</p>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Share report"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
            <path d="M12 3v12" />
            <path d="M8 7l4-4 4 4" />
          </svg>
        </button>
      </header>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
        <p className="m-0 text-center text-xs font-semibold tracking-[2px] text-[var(--accent)]">Crop Health Score</p>
        <div className="mt-5 flex items-center justify-center">
          <div className="relative grid h-32 w-32 place-items-center rounded-full bg-[conic-gradient(var(--accent)_0deg,var(--accent)_306deg,rgba(255,255,255,0.1)_306deg)]">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--surface)]">
              <span className="text-3xl font-bold">85%</span>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-center">
          <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
            Good Condition
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
        <img
          src="https://images.unsplash.com/photo-1467043153537-a4fba2cd39ef?auto=format&fit=crop&w=1200&q=80"
          alt=""
          className="h-44 w-full object-cover"
          loading="lazy"
        />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold">Early Blight Detected</h3>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              </span>
              92% Confidence
            </div>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            The scan indicates signs of Early Blight in the lower leaves. Immediate action is recommended to prevent
            spreading to the rest of your maize crop.
          </p>

          <p className="mt-4 text-xs font-semibold tracking-[2px] text-[var(--muted)]">Recommended Actions</p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-start gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3l18 18" />
                  <path d="M6 6l6 6" />
                  <path d="M14 4l6 6" />
                </svg>
              </span>
              <p className="m-0 text-sm text-[var(--text)]">Prune and destroy infected lower leaves immediately.</p>
            </div>
            <div className="flex items-start gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3v18" />
                  <path d="M8 7h8" />
                </svg>
              </span>
              <p className="m-0 text-sm text-[var(--text)]">Water at the base of the plant to keep foliage dry.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Quality Metrics</h3>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
                {metric.icon === "palette" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M8 11h.01" />
                    <path d="M12 8h.01" />
                    <path d="M16 11h.01" />
                    <path d="M14 15h.01" />
                  </svg>
                )}
                {metric.icon === "arrow" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 19V5" />
                    <path d="M6 9l6-6 6 6" />
                  </svg>
                )}
                {metric.icon === "drop" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 3C9 7 6 10 6 13a6 6 0 0 0 12 0c0-3-3-6-6-10z" />
                  </svg>
                )}
                {metric.icon === "bug" && (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M9 9h6" />
                    <path d="M9 15h6" />
                    <path d="M12 8V4" />
                    <path d="M12 20v-2" />
                    <rect x="8" y="9" width="8" height="6" rx="3" />
                  </svg>
                )}
              </span>
              <div>
                <p className="m-0 text-sm font-semibold">{metric.label}</p>
                <p className="m-0 text-xs text-[var(--muted)]">{metric.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--accent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
              <path d="M9 9h6" />
            </svg>
          </div>
          <div>
            <p className="m-0 text-sm font-semibold">Offline Analysis</p>
            <p className="m-0 text-xs text-[var(--muted)]">Save and sync when connected</p>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-xs font-semibold text-[var(--muted)]">Uncertain about results?</p>
            <p className="m-0 text-sm font-semibold">Verify with a human expert</p>
          </div>
          <button className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
            Contact Agronomist
          </button>
        </div>
      </div>

      <button className="w-full rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
        Confirm &amp; Save Report
      </button>
    </section>
  );
};

export default AIDiagnosis;
