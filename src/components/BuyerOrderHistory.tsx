import type { ViewMode } from "../types";

interface BuyerOrderHistoryProps {
  onNavigate?: (view: ViewMode) => void;
}

const orders = [
  {
    id: "AG-98234",
    title: "500kg Premium Maize",
    org: "Mutanguha Cooperative",
    price: "750,000",
    date: "Oct 24, 2023",
    rate: "1,500 RWF/kg",
    image:
      "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "AG-98112",
    title: "200kg Red Kidney Beans",
    org: "Kivu Agri-Group",
    price: "180,000",
    date: "Oct 15, 2023",
    rate: "900 RWF/kg",
    image:
      "https://images.unsplash.com/photo-1517130038641-a774d04afb3c?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "AG-97995",
    title: "450kg White Long Grain Rice",
    org: "Rwamagana Rice Coop",
    price: "490,000",
    date: "Sep 29, 2023",
    rate: "1,100 RWF/kg",
    image:
      "https://images.unsplash.com/photo-1549015663-6b6a1a3c0f2d?auto=format&fit=crop&w=600&q=80",
  },
];

const BuyerOrderHistory = ({ onNavigate }: BuyerOrderHistoryProps) => {
  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-10">
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
        <div>
          <p className="m-0 text-base font-semibold">Order History</p>
          <p className="m-0 text-xs text-[var(--accent)]">Commercial Buyer Account</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Filter"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6h16" />
              <path d="M8 12h8" />
              <path d="M10 18h4" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex gap-6 border-b border-[var(--stroke)] pb-3 text-sm font-semibold">
        {[
          { label: "All Orders", active: true },
          { label: "Completed", active: false },
          { label: "In Progress", active: false },
          { label: "Cancelled", active: false },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`pb-2 ${tab.active ? "text-[var(--accent)] border-b-2 border-[var(--accent)]" : "text-[var(--muted)]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Spent</p>
          <p className="mt-3 text-xl font-semibold">1,420,000 <span className="text-sm text-[var(--muted)]">RWF</span></p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Total Volume</p>
          <p className="mt-3 text-xl font-semibold">1,150 <span className="text-sm text-[var(--muted)]">KG</span></p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {orders.map((order) => (
          <div key={order.id} className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)]">
            <div className="flex gap-4 p-4">
              <img src={order.image} alt="" className="h-20 w-20 rounded-[16px] object-cover" loading="lazy" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="m-0 text-xs font-semibold text-[var(--accent)]">Order #{order.id}</p>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">
                    100% Done
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold">{order.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{order.org}</p>
                <p className="mt-3 text-base font-semibold">{order.price} <span className="text-xs text-[var(--muted)]">RWF</span></p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] px-4 py-3 text-xs text-[var(--muted)]">
              <span>{order.date} · {order.rate}</span>
              <div className="flex gap-2">
                <button className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
                  Receipt
                </button>
                <button className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
                  Cert
                </button>
                <button className="rounded-[12px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
                  Share
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="fixed bottom-24 right-6 sm:right-10 flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-3 text-xs font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.4)]"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Batch Export
      </button>

      <nav className="mt-4 grid grid-cols-5 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Home", active: false },
          { label: "Browse", active: false },
          { label: "Active", active: false },
          { label: "History", active: true },
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
              {item.label === "Home" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v9h14v-9" />
                </svg>
              )}
              {item.label === "Browse" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v4" />
                  <path d="M12 18v4" />
                  <path d="M2 12h4" />
                  <path d="M18 12h4" />
                </svg>
              )}
              {item.label === "Active" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 7h16v10H4z" />
                  <path d="M4 11h16" />
                </svg>
              )}
              {item.label === "History" && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 6h16" />
                  <path d="M4 12h10" />
                  <path d="M4 18h8" />
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

export default BuyerOrderHistory;
