import type { ViewMode } from "../types";

interface ProduceInventoryProps {
  onNavigate?: (view: ViewMode) => void;
}

const stockItems = [
  {
    name: "Maize",
    stored: "Oct 12, 2023",
    quantity: "450",
    unit: "kg",
    status: "In storage",
    statusClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    image:
      "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Beans",
    stored: "Sep 28, 2023",
    quantity: "320",
    unit: "kg",
    status: "In storage",
    statusClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    image:
      "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Irish Potatoes",
    stored: "Oct 05, 2023",
    quantity: "280",
    unit: "kg",
    status: "Selling fast",
    statusClass: "bg-amber-500/20 text-amber-300",
    image:
      "https://images.unsplash.com/photo-1506806732259-39c2d0268443?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Rice",
    stored: "Sep 15, 2023",
    quantity: "200",
    unit: "kg",
    status: "Low stock",
    statusClass: "bg-[var(--surface-2)] text-[var(--muted)]",
    image:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=400&q=80",
  },
];

const ProduceInventory = ({ onNavigate }: ProduceInventoryProps) => {
  return (
    <section className="relative w-full max-w-[680px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-10 w-10 rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] grid place-items-center"
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h10" />
            </svg>
          </button>
          <div>
            <p className="m-0 text-lg font-semibold">Produce Inventory</p>
            <p className="m-0 text-xs text-[var(--muted)]">Track stored crops and availability</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative h-10 w-10 rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] grid place-items-center"
            aria-label="Notifications"
          >
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--accent)]" />
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </button>
          <div className="h-10 w-10 rounded-full border border-[var(--stroke)] bg-[var(--surface-2)] grid place-items-center">
            <span className="text-xs font-semibold text-[var(--accent)]">MA</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-[var(--surface-2)] grid place-items-center">
              <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M7 6h10v12H7z" />
                <path d="M9 6V4h6v2" />
              </svg>
            </div>
            <div>
              <p className="m-0 text-xs font-semibold text-[var(--muted)]">Total Stock</p>
              <p className="m-0 mt-2 text-2xl font-bold">
                1,250 <span className="text-sm font-semibold text-[var(--muted)]">kg</span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[14px] bg-[var(--surface-2)] grid place-items-center">
              <svg className="h-5 w-5 text-sky-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 6v12" />
                <path d="M6 12h12" />
                <path d="M8 6c1.5-1 6.5-1 8 0" />
              </svg>
            </div>
            <div>
              <p className="m-0 text-xs font-semibold text-[var(--muted)]">Crop Types</p>
              <p className="m-0 mt-2 text-2xl font-bold">
                4 <span className="text-sm font-semibold text-[var(--muted)]">Crops</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
          <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="text"
            placeholder="Search crops..."
            className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <button
          type="button"
          className="h-12 w-12 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] grid place-items-center"
          aria-label="Filter"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16" />
            <path d="M8 12h8" />
            <path d="M10 18h4" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Current Stock</h3>
        <button type="button" className="text-xs font-semibold text-[var(--accent)]">
          Sort by: Date
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {stockItems.map((item) => (
          <div key={item.name} className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={item.image}
                  alt=""
                  className="h-16 w-16 rounded-[16px] object-cover"
                  loading="lazy"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="m-0 text-base font-semibold">{item.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${item.statusClass}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="4" y="5" width="16" height="15" rx="2" />
                      <path d="M8 3v4" />
                      <path d="M16 3v4" />
                    </svg>
                    Stored: {item.stored}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-[var(--accent)]">
                    {item.quantity} <span className="text-sm font-semibold text-[var(--muted)]">{item.unit}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="self-start rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-2 text-xs font-semibold text-[var(--text)] sm:self-center"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-6 sm:right-10 h-14 w-14 rounded-full bg-[var(--accent)] text-3xl text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.4)]"
        aria-label="Add crop"
      >
        +
      </button>

      <nav className="mt-4 grid grid-cols-5 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          {
            label: "Home",
            active: false,
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
            active: true,
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
            label: "Advice",
            active: false,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4" />
              </svg>
            ),
          },
          {
            label: "More",
            active: false,
            icon: (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="2" />
                <circle cx="6" cy="12" r="2" />
                <circle cx="18" cy="12" r="2" />
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

export default ProduceInventory;
