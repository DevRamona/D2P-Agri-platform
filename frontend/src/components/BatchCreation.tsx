import type { ViewMode } from "../types";

interface BatchCreationProps {
  onNavigate?: (view: ViewMode) => void;
}

const items = [
  {
    name: "Maize (Grade A)",
    score: "98/100",
    weight: "500 kg",
    image:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Dry Beans",
    score: "92/100",
    weight: "200 kg",
    image:
      "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80",
  },
];

const BatchCreation = ({ onNavigate }: BatchCreationProps) => {
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
        <p className="m-0 text-base font-semibold">Batch Creation</p>
        <span className="text-xs font-semibold text-[var(--accent)]">Draft</span>
      </header>

      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className={`h-2 w-8 rounded-full ${index === 3 ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"}`}
          />
        ))}
      </div>

      <div>
        <h1 className="m-0 text-2xl font-semibold">Finalize your sale batch</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Combine your harvested items, verify quality scores, and set your market price.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Select Items</h3>
        <span className="text-xs font-semibold text-[var(--accent)]">2 Selected</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item) => (
          <div
            key={item.name}
            className="min-w-[220px] rounded-[22px] border border-[var(--accent)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
          >
            <div className="relative">
              <img src={item.image} alt="" className="h-28 w-full rounded-[16px] object-cover" loading="lazy" />
              <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12l4 4 10-10" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <p className="m-0 text-sm font-semibold">{item.name}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--accent)]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--accent-soft)]">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </span>
                AI: {item.score}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{item.weight}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Set Batch Price</h3>
      </div>
      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
        <p className="m-0 text-xs font-semibold text-[var(--muted)]">Total Price (RWF)</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-3xl font-bold">350,000</span>
          <span className="text-sm font-semibold text-[var(--accent)]">RWF</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] pt-4">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <svg className="h-4 w-4 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 12l6-6 4 4 7-7" />
              <path d="M21 10v5h-5" />
            </svg>
            Market Avg: 342,000 RWF
          </div>
          <button className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
            Apply Suggestion
          </button>
        </div>
      </div>

      <div>
        <h3 className="m-0 text-base font-semibold">Destination Hub</h3>
      </div>
      <button
        type="button"
        className="flex items-center justify-between rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[var(--surface-2)] text-[var(--accent)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
              <path d="M9 9h6" />
            </svg>
          </span>
          <div>
            <p className="m-0 text-sm font-semibold">Kigali Central Aggregator</p>
            <p className="m-0 text-xs text-[var(--muted)]">Kigali, Rwanda · 12km away</p>
          </div>
        </div>
        <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span>Total Items</span>
            <span className="text-[var(--text)]">2 Crops</span>
          </div>
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span>Total Weight</span>
            <span className="text-[var(--text)]">700 kg</span>
          </div>
          <div className="flex items-center justify-between text-[var(--accent)]">
            <span>Est. Net Profit</span>
            <span className="font-semibold">325,500 RWF</span>
          </div>
        </div>
      </div>

      <button className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
        Create &amp; Publish Batch
      </button>
    </section>
  );
};

export default BatchCreation;
