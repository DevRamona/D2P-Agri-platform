import type { ViewMode } from "../types";

interface BuyerMarketplaceProps {
  onNavigate?: (view: ViewMode) => void;
}

const categories = [
  { label: "All Crops", active: true },
  { label: "Maize", active: false },
  { label: "Beans", active: false },
  { label: "Coffee", active: false },
];

const batches = [
  {
    title: "Premium Grade A Maize",
    location: "Kayonza District, Eastern Province",
    weight: "2,500",
    price: "450",
    total: "1,125,000",
    tag: "Verified",
    score: "9.2/10",
    image:
      "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Red Kidney Beans",
    location: "Musanze District, Northern Province",
    weight: "1,200",
    price: "820",
    total: "984,000",
    tag: "Top Quality",
    score: "8.8/10",
    image:
      "https://images.unsplash.com/photo-1517130038641-a774d04afb3c?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Arabica Coffee Cherries",
    location: "Nyamagabe District, Southern Province",
    weight: "1,800",
    price: "1,100",
    total: "1,980,000",
    tag: "Pending",
    score: "--",
    image:
      "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=900&q=80",
  },
];

const BuyerMarketplace = ({ onNavigate }: BuyerMarketplaceProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h10" />
            </svg>
          </button>
          <div>
            <p className="m-0 text-base font-semibold">Marketplace</p>
            <p className="m-0 text-xs text-[var(--accent)]">Buyer Portal · Rwanda</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Cart"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
              <path d="M3 3h2l2 12h11l2-8H7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
        <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="text"
          placeholder="Search crops, regions or grades..."
          className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
        />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-[12px] bg-[var(--surface)]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16" />
            <path d="M8 12h8" />
            <path d="M10 18h4" />
          </svg>
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat.label}
            type="button"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
              cat.active
                ? "bg-[var(--accent)] text-[#0b1307]"
                : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--muted)]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Available Batches</h3>
        <span className="text-xs font-semibold text-[var(--accent)]">248 Total</span>
      </div>

      <div className="flex flex-col gap-5">
        {batches.map((batch) => (
          <div key={batch.title} className="overflow-hidden rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)]">
            <div className="relative">
              <img src={batch.image} alt="" className="h-40 w-full object-cover" loading="lazy" />
              <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-[#0b1307]">
                {batch.tag}
              </span>
              <span className="absolute right-4 top-4 rounded-[12px] bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
                AI Score {batch.score}
              </span>
            </div>
            <div className="p-4">
              <h4 className="m-0 text-base font-semibold">{batch.title}</h4>
              <p className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
                  <path d="M9 9h6" />
                </svg>
                {batch.location}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[2px]">Weight</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">{batch.weight} kg</p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-[10px] uppercase tracking-[2px]">Price / kg</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{batch.price} RWF</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[2px] text-[var(--muted)]">Total Value</p>
                  <p className="mt-1 text-sm font-semibold">{batch.total} RWF</p>
                </div>
                <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0b1307]">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-6 sm:right-10 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.4)]"
        aria-label="Quick filter"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 6h16" />
          <path d="M8 12h8" />
          <path d="M10 18h4" />
        </svg>
      </button>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Discover", active: true },
          { label: "Orders", active: false },
          { label: "Bids", active: false },
          { label: "Profile", active: false },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${
              item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.label === "Discover" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 4h7v7H4z" />
                  <path d="M13 4h7v7h-7z" />
                  <path d="M4 13h7v7H4z" />
                  <path d="M13 13h7v7h-7z" />
                </svg>
              )}
              {item.label === "Orders" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 7h16v12H4z" />
                  <path d="M4 11h16" />
                </svg>
              )}
              {item.label === "Bids" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 20V4" />
                  <path d="M8 20V10" />
                  <path d="M12 20V6" />
                  <path d="M16 20V14" />
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

export default BuyerMarketplace;
