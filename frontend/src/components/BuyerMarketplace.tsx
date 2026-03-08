import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/client";
import {
  getBuyerMarketplace,
  type BuyerMarketplaceBatch,
  type BuyerMarketplaceCategory,
  type BuyerMarketplaceData,
} from "../api/buyer";
import type { ViewMode } from "../types";
import { setBuyerSelectedBatch } from "../utils/buyerCheckout";

interface BuyerMarketplaceProps {
  onNavigate?: (view: ViewMode) => void;
}

const FALLBACK_IMAGE = "https://placehold.co/900x400?text=Produce+Batch";

const normalizeCropKey = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("bean")) return "beans";
  if (normalized.includes("maize") || normalized.includes("corn")) return "maize";
  if (normalized.includes("coffee")) return "coffee";
  return normalized;
};

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) {
    return `${API_BASE}${image}`;
  }
  return image;
};

const formatCurrency = (value: number) => Math.round(Number(value) || 0).toLocaleString();

const BuyerMarketplace = ({ onNavigate }: BuyerMarketplaceProps) => {
  const [marketplace, setMarketplace] = useState<BuyerMarketplaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;

    const loadMarketplace = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBuyerMarketplace();
        if (!cancelled) {
          setMarketplace(data);
        }
      } catch (err) {
        console.error("Failed to load buyer marketplace", err);
        if (!cancelled) {
          setError("Unable to load available farmer batches right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMarketplace();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const backendCategories = marketplace?.categories || [];
    if (backendCategories.length > 0) {
      return backendCategories;
    }
    return [
      { key: "all", label: "All Crops", count: 0 },
      { key: "maize", label: "Maize", count: 0 },
      { key: "beans", label: "Beans", count: 0 },
      { key: "coffee", label: "Coffee", count: 0 },
    ] as BuyerMarketplaceCategory[];
  }, [marketplace]);

  const visibleBatches = useMemo(() => {
    const allBatches = marketplace?.batches || [];
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allBatches.filter((batch) => {
      const cropMatches = activeCategory === "all" || batch.cropKey === activeCategory;
      if (!cropMatches) return false;

      if (!normalizedSearch) return true;
      const haystack = [
        batch.title,
        batch.farmerName,
        batch.destination,
        ...batch.cropNames,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [marketplace, searchTerm, activeCategory]);

  const getCategoryCount = (categoryKey: string) => {
    if (categoryKey === "all") return marketplace?.allCount ?? 0;
    return (marketplace?.batches || []).filter((batch) => batch.cropKey === categoryKey).length;
  };

  const handleCategorySelect = (categoryKey: string) => {
    setActiveCategory(categoryKey);
  };

  const renderBatchMeta = (batch: BuyerMarketplaceBatch) => {
    const dateLabel = new Date(batch.createdAt).toLocaleDateString();
    const cropSummary =
      batch.cropNames.length > 0 ? batch.cropNames.join(", ") : `${normalizeCropKey(batch.cropKey)} crop batch`;
    return `Farmer: ${batch.farmerName} · ${dateLabel} · ${cropSummary}`;
  };

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
            <p className="m-0 text-xs text-[var(--accent)]">Buyer Portal · Live farmer batches</p>
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

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3">
        <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="11" cy="11" r="6" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="text"
          placeholder="Search crops, farmers, destination..."
          className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-[12px] bg-[var(--surface)]" aria-label="Filter">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 6h16" />
            <path d="M8 12h8" />
            <path d="M10 18h4" />
          </svg>
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {categories.map((cat) => {
          const active = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategorySelect(cat.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
                active
                  ? "bg-[var(--accent)] text-[#0b1307]"
                  : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {cat.label}{" "}
              <span className={active ? "text-[#0b1307]/80" : "text-[var(--muted)]"}>
                ({cat.key === "all" ? marketplace?.allCount ?? cat.count : getCategoryCount(cat.key)})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold">Available Batches</h3>
        <span className="text-xs font-semibold text-[var(--accent)]">
          {loading ? "Loading..." : `${visibleBatches.length} Listed`}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {loading && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Loading farmer batches...
          </div>
        )}

        {!loading && visibleBatches.length === 0 && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            No batches match your current search/filter.
          </div>
        )}

        {visibleBatches.map((batch) => (
          <div key={batch.id} className="overflow-hidden rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)]">
            <div className="relative">
              <img
                src={resolveImageUrl(batch.image)}
                alt={batch.title}
                className="h-40 w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              <span className="absolute left-4 top-4 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-semibold text-[#0b1307]">
                {batch.tag}
              </span>
              <span className="absolute right-4 top-4 rounded-[12px] bg-black/60 px-3 py-1 text-[10px] font-semibold text-white">
                AI Score {batch.aiScore == null ? "--" : `${batch.aiScore}/10`}
              </span>
            </div>
            <div className="p-4">
              <h4 className="m-0 text-base font-semibold">{batch.title}</h4>
              <p className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
                  <path d="M9 9h6" />
                </svg>
                {batch.destination}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">{renderBatchMeta(batch)}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[2px]">Weight</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text)]">
                    {formatCurrency(batch.totalWeight)} kg
                  </p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-[10px] uppercase tracking-[2px]">Price / kg</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--accent)]">
                    {formatCurrency(batch.pricePerKg)} RWF
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="m-0 text-[10px] uppercase tracking-[2px] text-[var(--muted)]">Total Value</p>
                  <p className="mt-1 text-sm font-semibold">{formatCurrency(batch.totalPrice)} RWF</p>
                </div>
                <button
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[#0b1307]"
                  type="button"
                  onClick={() => {
                    setBuyerSelectedBatch(batch);
                    onNavigate?.("buyer-batch-details");
                  }}
                >
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

      <p className="m-0 text-center text-xs text-[var(--muted)]">
        Last synced:{" "}
        {marketplace?.lastSynced
          ? new Date(marketplace.lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "--:--"}
      </p>

      <nav className="mt-4 grid grid-cols-4 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Discover", active: true, target: "buyer-marketplace" as const },
          { label: "Orders", active: false, target: "buyer-order-history" as const },
          { label: "Bids", active: false },
          { label: "Profile", active: false, target: "buyer-profile" as const },
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
