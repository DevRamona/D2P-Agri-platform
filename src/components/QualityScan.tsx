import type { ViewMode } from "../types";

interface QualityScanProps {
  onNavigate?: (view: ViewMode) => void;
}

const QualityScan = ({ onNavigate }: QualityScanProps) => {
  return (
    <section className="relative w-full max-w-[520px] overflow-hidden rounded-[32px] bg-[var(--surface)] shadow-[var(--shadow)]">
      <img
        src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,6,0.75),rgba(8,12,6,0.35)_45%,rgba(8,12,6,0.9))]" />

      <div className="relative z-10 flex min-h-[780px] flex-col px-6 pb-8 pt-6">
        <header className="flex items-center justify-between">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/30 text-white"
            onClick={() => onNavigate?.("farmer-dashboard")}
            aria-label="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-center">
            <p className="m-0 text-lg font-semibold text-white">AI Quality Scan</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              {Array.from({ length: 7 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-2 w-2 rounded-full ${index === 2 ? "w-5 bg-[var(--accent)]" : "bg-white/30"}`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-black/30 text-white"
            aria-label="Help"
          >
            <span className="text-lg font-semibold">?</span>
          </button>
        </header>

        <div className="mt-8 text-center">
          <h1 className="m-0 text-3xl font-semibold text-white">Scan Maize Kernels</h1>
          <p className="mt-2 text-sm text-white/70">Keep the camera steady within frame</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[#0b1307] shadow-[0_12px_24px_rgba(73,197,26,0.35)]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[var(--accent)]">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12l4 4 10-10" />
              </svg>
            </span>
            Ideal Distance
          </div>
        </div>

        <div className="relative mt-8 flex-1">
          <div className="absolute inset-0">
            <span className="absolute left-2 top-2 h-8 w-8 border-l-4 border-t-4 border-[var(--accent)]" />
            <span className="absolute right-2 top-2 h-8 w-8 border-r-4 border-t-4 border-[var(--accent)]" />
            <span className="absolute left-2 bottom-2 h-8 w-8 border-b-4 border-l-4 border-[var(--accent)]" />
            <span className="absolute right-2 bottom-2 h-8 w-8 border-b-4 border-r-4 border-[var(--accent)]" />
            <span className="absolute left-[30%] top-[35%] h-4 w-4 rounded-full border-2 border-[var(--accent)]" />
            <span className="absolute left-[45%] top-[55%] h-4 w-4 rounded-full border-2 border-[var(--accent)]" />
            <span className="absolute left-[60%] top-[60%] h-4 w-4 rounded-full border-2 border-[var(--accent)]" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button className="grid h-12 w-12 place-items-center rounded-full bg-black/40 text-white" aria-label="Flash">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M7 2h10l-4 7h4l-8 13 2-9H7z" />
            </svg>
          </button>
          <div className="flex-1 rounded-full bg-black/40 p-1">
            <div className="grid grid-cols-2">
              <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0b1307]">
                Maize
              </button>
              <button className="rounded-full px-4 py-2 text-xs font-semibold text-white/70">Beans</button>
            </div>
          </div>
          <button className="grid h-12 w-12 place-items-center rounded-full bg-black/40 text-white" aria-label="Mute">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M11 5L6 9H3v6h3l5 4V5z" />
              <path d="M16 9l5 5" />
              <path d="M21 9l-5 5" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            className="relative grid h-20 w-20 place-items-center rounded-full bg-white/90"
            aria-label="Capture"
          >
            <span className="absolute inset-1 rounded-full border-[6px] border-[var(--accent)]" />
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white">
              <span className="h-3 w-3 rounded-full bg-[var(--accent)]" />
            </span>
          </button>
        </div>

        <div className="mt-6 rounded-[22px] border border-white/10 bg-black/40 p-4 text-white/80">
          <div className="flex items-center justify-between">
            <p className="m-0 text-xs font-semibold tracking-[2px] text-white/70">Real-time Analysis</p>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              On-device AI Active
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Moisture", value: "13.5%" },
              { label: "Pests", value: "None" },
              { label: "Color", value: "Grade A" },
            ].map((item) => (
              <div key={item.label} className="rounded-[16px] border border-white/10 bg-white/10 px-3 py-3">
                <p className="m-0 text-[10px] text-white/60">{item.label}</p>
                <p className="m-0 mt-2 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default QualityScan;
