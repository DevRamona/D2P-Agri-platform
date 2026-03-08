import { API_BASE } from "../api/client";
import type { ViewMode } from "../types";
import { getBuyerOrderQuote, getBuyerSelectedBatch } from "../utils/buyerCheckout";

interface BuyerBatchDetailsProps {
  onNavigate?: (view: ViewMode) => void;
}

const FALLBACK_IMAGE = "https://placehold.co/900x500?text=Farmer+Batch";

const formatCurrency = (value: number) => `${Math.round(Number(value) || 0).toLocaleString()} RWF`;

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

const BuyerBatchDetails = ({ onNavigate }: BuyerBatchDetailsProps) => {
  const batch = getBuyerSelectedBatch();
  const quote = getBuyerOrderQuote(batch);

  if (!batch) {
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
          <p className="m-0 text-base font-semibold">Batch Details</p>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>

        <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
          No farmer batch selected. Go back to the marketplace and choose a batch first.
        </div>

        <button
          type="button"
          className="w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#0b1307]"
          onClick={() => onNavigate?.("buyer-marketplace")}
        >
          Browse Marketplace
        </button>
      </section>
    );
  }

  const listedDate = batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : "--";

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
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[2px] text-[var(--accent)]">Farmer Batch</p>
          <p className="m-0 text-base font-semibold truncate max-w-[220px]">{batch.title}</p>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Share batch"
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

      <div className="overflow-hidden rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)]">
        <div className="relative">
          <img
            src={resolveImageUrl(batch.image)}
            alt={batch.title}
            className="h-44 w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-[#0b1307]">
            {batch.tag || "Listed"}
          </span>
          <span className="absolute right-4 top-4 rounded-[12px] bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
            {batch.cropNames.length > 0 ? batch.cropNames.join(", ") : "Mixed batch"}
          </span>
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="m-0 text-lg font-semibold truncate">{batch.title}</h2>
              <p className="mt-1 text-xs text-[var(--muted)] truncate">Farmer: {batch.farmerName}</p>
              <p className="mt-1 text-xs text-[var(--muted)] truncate">Destination: {batch.destination}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Listed: {listedDate}</p>
            </div>
            <div className="text-right">
              <p className="m-0 text-[10px] uppercase tracking-[2px] text-[var(--muted)]">Total Value</p>
              <p className="mt-2 text-base font-semibold text-[var(--accent)]">{formatCurrency(batch.totalPrice)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Weight</p>
          <p className="mt-2 text-lg font-semibold">{Math.round(batch.totalWeight).toLocaleString()} kg</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Price / kg</p>
          <p className="mt-2 text-lg font-semibold">{formatCurrency(batch.pricePerKg)}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Products</p>
          <p className="mt-2 text-lg font-semibold">{batch.productCount || batch.products.length || batch.cropNames.length || 1}</p>
        </div>
        <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-xs uppercase tracking-[2px] text-[var(--muted)]">Status</p>
          <p className="mt-2 text-lg font-semibold capitalize">{batch.status || "active"}</p>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold">Product Breakdown</h3>
          <span className="text-xs text-[var(--muted)]">{batch.products.length || batch.cropNames.length} items</span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {batch.products.length > 0 ? (
            batch.products.map((entry, idx) => (
              <div
                key={`${entry.product.id}-${idx}`}
                className="flex items-center justify-between rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3"
              >
                <div>
                  <p className="m-0 text-sm font-semibold">{entry.product.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{entry.product.unit || "kg"}</p>
                </div>
                <p className="m-0 text-sm font-semibold">{Math.round(entry.quantity || 0).toLocaleString()} {entry.product.unit || "kg"}</p>
              </div>
            ))
          ) : (
            batch.cropNames.map((name) => (
              <div
                key={name}
                className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-sm"
              >
                {name}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold">Order & Deposit Preview</h3>
          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-semibold text-[var(--accent)]">
            Escrow
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-xs text-[var(--muted)]">Amount Due Today</p>
            <p className="mt-2 text-base font-semibold text-[var(--accent)]">{formatCurrency(quote.amountDueToday)}</p>
          </div>
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-xs text-[var(--muted)]">Balance on Delivery</p>
            <p className="mt-2 text-base font-semibold">{formatCurrency(quote.balanceDue)}</p>
          </div>
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-xs text-[var(--muted)]">Deposit</p>
            <p className="mt-2 text-sm font-semibold">{formatCurrency(quote.depositAmount)} ({Math.round(quote.depositPercent * 100)}%)</p>
          </div>
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] p-3">
            <p className="m-0 text-xs text-[var(--muted)]">Service Fee</p>
            <p className="mt-2 text-sm font-semibold">{formatCurrency(quote.serviceFee)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <h3 className="m-0 text-base font-semibold">Batch Source</h3>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <div className="flex items-start justify-between gap-3 rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
            <div>
              <p className="m-0 text-xs text-[var(--muted)]">Farmer</p>
              <p className="mt-1 font-semibold">{batch.farmerName}</p>
            </div>
            <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[10px] uppercase tracking-[1.5px] text-[var(--muted)]">
              {batch.status}
            </span>
          </div>
          <div className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
            <p className="m-0 text-xs text-[var(--muted)]">Delivery Hub / Destination</p>
            <p className="mt-1 font-semibold">{batch.destination}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold" type="button">
          Contact
        </button>
        <button
          className="flex-[2] rounded-[16px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]"
          type="button"
          onClick={() => onNavigate?.("order-review")}
        >
          Proceed to Order Review
        </button>
      </div>
    </section>
  );
};

export default BuyerBatchDetails;
