import { useEffect, useState } from "react";
import { getInventory, getMarket, type FarmerMarketData, type Product } from "../api/farmer";
import type { ViewMode } from "../types";

interface FarmerMarketProps {
  onNavigate?: (view: ViewMode) => void;
}

type InventoryMarketRow = {
  product: Product;
  marketCrop: string | null;
  marketPricePerUnit: number | null;
  marketPriceLabel: string | null;
  estimatedMarketValue: number | null;
  estimatedListedValue: number;
  spreadPerUnit: number | null;
  spreadTotal: number | null;
};

const parsePrice = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeCropKey = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("bean")) return "beans";
  if (normalized.includes("maize") || normalized.includes("corn")) return "maize";
  if (normalized.includes("coffee")) return "coffee";
  if (normalized.includes("potato")) return "potato";
  if (normalized.includes("onion")) return "onion";
  if (normalized.includes("carrot")) return "carrot";
  return normalized;
};

const formatCurrency = (value: number, currency = "RWF") =>
  `${Math.round(Number(value) || 0).toLocaleString()} ${currency}`;

const formatSignedCurrency = (value: number, currency = "RWF") => {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(Math.round(value)).toLocaleString()} ${currency}`;
};

const FarmerMarket = ({ onNavigate }: FarmerMarketProps) => {
  const [marketData, setMarketData] = useState<FarmerMarketData | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMarketData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [marketResult, inventoryResult] = await Promise.all([getMarket(), getInventory()]);
        if (cancelled) return;
        setMarketData(marketResult);
        setInventory(inventoryResult || []);
      } catch (err) {
        console.error("Failed to load farmer market page", err);
        if (!cancelled) {
          setError("Unable to load market data right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMarketData();
    return () => {
      cancelled = true;
    };
  }, []);

  const marketPrices = marketData?.marketPrices || [];
  const marketPriceByCrop = new Map(
    marketPrices.map((item) => [normalizeCropKey(item.crop), item] as const),
  );

  const inventoryRows: InventoryMarketRow[] = inventory.map((product) => {
    const matchedMarket = marketPriceByCrop.get(normalizeCropKey(product.name));
    const marketPricePerUnit = matchedMarket ? parsePrice(matchedMarket.price) : null;
    const quantity = Number(product.quantity) || 0;
    const farmerPricePerUnit = Number(product.pricePerUnit) || 0;
    const estimatedListedValue = quantity * farmerPricePerUnit;
    const estimatedMarketValue = marketPricePerUnit === null ? null : quantity * marketPricePerUnit;
    const spreadPerUnit = marketPricePerUnit === null ? null : farmerPricePerUnit - marketPricePerUnit;
    const spreadTotal = marketPricePerUnit === null || estimatedMarketValue === null ? null : estimatedListedValue - estimatedMarketValue;

    return {
      product,
      marketCrop: matchedMarket?.crop || null,
      marketPricePerUnit,
      marketPriceLabel: matchedMarket ? `${matchedMarket.price} ${matchedMarket.unit}` : null,
      estimatedMarketValue,
      estimatedListedValue,
      spreadPerUnit,
      spreadTotal,
    };
  });

  const matchedRows = inventoryRows.filter((row) => row.marketPricePerUnit !== null);
  const unmatchedRows = inventoryRows.filter((row) => row.marketPricePerUnit === null);
  const totalListedValue = inventoryRows.reduce((sum, row) => sum + row.estimatedListedValue, 0);
  const totalBenchmarkValue = matchedRows.reduce((sum, row) => sum + (row.estimatedMarketValue || 0), 0);
  const totalSpread = matchedRows.reduce((sum, row) => sum + (row.spreadTotal || 0), 0);
  const positiveMoves = marketPrices.filter((item) => item.positive).length;
  const bestRisingCrop = marketPrices.find((item) => item.positive) || null;
  const topMatchedRow =
    [...matchedRows].sort((a, b) => (b.estimatedMarketValue || 0) - (a.estimatedMarketValue || 0))[0] || null;

  return (
    <section className="w-full max-w-[720px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-[14px] border border-[var(--stroke)] bg-[var(--surface-2)]"
            aria-label="Back to dashboard"
            onClick={() => onNavigate?.("dashboard")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <p className="m-0 text-lg font-semibold">Farmer Market</p>
            <p className="m-0 text-xs text-[var(--muted)]">Market signals and pricing reference for your crops</p>
          </div>
        </div>
        <button
          type="button"
          className="rounded-[14px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold"
          onClick={() => onNavigate?.("batch-creation")}
        >
          Create Batch
        </button>
      </header>

      {error && (
        <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-[24px] border border-[var(--stroke)] bg-[linear-gradient(135deg,rgba(73,197,26,0.16),rgba(73,197,26,0.04))] p-5 shadow-[var(--shadow)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-[var(--accent)]">Market Overview</p>
            <p className="mt-2 mb-0 text-2xl font-bold">
              {loading ? "..." : `${marketPrices.length} tracked prices`}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {loading
                ? "Loading market signals..."
                : `${positiveMoves} rising · ${marketPrices.length - positiveMoves} softening`}
            </p>
            {!loading && marketData?.seededDefaults && (
              <p className="mt-2 text-xs text-amber-300">
                Using seeded DB prices. Update the `MarketPrice` collection with current market data.
              </p>
            )}
          </div>
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm">
            <p className="m-0 text-xs text-[var(--muted)]">Last Synced</p>
            <p className="mt-1 font-semibold">
              {marketData?.lastSynced
                ? new Date(marketData.lastSynced).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "--:--"}
            </p>
            {!loading && (
              <p className="mt-1 text-[10px] uppercase tracking-[1px] text-[var(--muted)]">{marketData?.source || "database"}</p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs text-[var(--muted)]">Your Inventory (Ask Price)</p>
            <p className="mt-2 text-xl font-semibold">{loading ? "..." : formatCurrency(totalListedValue)}</p>
          </div>
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs text-[var(--muted)]">Matched Benchmark Value</p>
            <p className="mt-2 text-xl font-semibold">{loading ? "..." : formatCurrency(totalBenchmarkValue)}</p>
          </div>
          <div className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <p className="m-0 text-xs text-[var(--muted)]">Ask vs Market Spread</p>
            <p className={`mt-2 text-xl font-semibold ${totalSpread >= 0 ? "text-[var(--accent)]" : "text-red-400"}`}>
              {loading ? "..." : formatSignedCurrency(totalSpread)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Market Prices</h3>
        <button
          type="button"
          className="text-xs font-semibold text-[var(--accent)]"
          onClick={() => onNavigate?.("dashboard")}
        >
          Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            Loading market prices...
          </div>
        )}
        {!loading && marketPrices.length === 0 && (
          <div className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            No market prices available.
          </div>
        )}
        {marketPrices.map((item) => (
          <div key={item.crop} className="rounded-[18px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold">{item.crop}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  item.positive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-red-500/15 text-red-400"
                }`}
              >
                {item.change}
              </span>
            </div>
            <p className="mt-3 mb-0 text-xl font-semibold">
              {item.price}
              <span className="ml-1 text-xs font-semibold text-[var(--muted)]">{item.unit}</span>
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {item.positive ? "Demand trend improving" : "Price softened recently"}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold tracking-[2px] text-[var(--muted)]">Your Inventory vs Market</h3>
        <button type="button" className="text-xs font-semibold text-[var(--accent)]" onClick={() => onNavigate?.("inventory")}>
          Manage Inventory
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {loading && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            Matching your inventory against current market prices...
          </div>
        )}

        {!loading && inventoryRows.length === 0 && (
          <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            No inventory items found. Add produce in Inventory to see market comparisons.
          </div>
        )}

        {inventoryRows.map((row) => (
          <div key={row.product._id} className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 text-sm font-semibold">{row.product.name}</p>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                    {(Number(row.product.quantity) || 0).toLocaleString()} {row.product.unit || "kg"}
                  </span>
                  {row.marketCrop && (
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      Matched to {row.marketCrop}
                    </span>
                  )}
                </div>
                <p className="mt-2 mb-0 text-xs text-[var(--muted)]">
                  Your price: {formatCurrency(Number(row.product.pricePerUnit) || 0)} / {row.product.unit || "kg"}
                </p>
                <p className="mt-1 mb-0 text-xs text-[var(--muted)]">
                  Market benchmark: {row.marketPriceLabel || "No benchmark match"}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="m-0 text-sm font-semibold">
                  Ask total: {formatCurrency(row.estimatedListedValue)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Benchmark total: {row.estimatedMarketValue === null ? "--" : formatCurrency(row.estimatedMarketValue)}
                </p>
                {row.spreadTotal !== null && (
                  <p className={`mt-2 text-xs font-semibold ${row.spreadTotal >= 0 ? "text-[var(--accent)]" : "text-red-400"}`}>
                    {formatSignedCurrency(row.spreadTotal)} vs market
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm font-semibold">Opportunity Signal</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {bestRisingCrop
              ? `${bestRisingCrop.crop} is trending up (${bestRisingCrop.change}). Consider preparing a batch if quality is ready.`
              : "No positive market movement available yet."}
          </p>
          <button
            type="button"
            className="mt-4 rounded-[12px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#0b1307]"
            onClick={() => onNavigate?.("batch-creation")}
          >
            Prepare Batch
          </button>
        </div>
        <div className="rounded-[20px] border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <p className="m-0 text-sm font-semibold">Coverage Check</p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            {topMatchedRow
              ? `Highest matched value right now is ${topMatchedRow.product.name} at ${formatCurrency(
                  topMatchedRow.estimatedMarketValue || 0,
                )} benchmark value.`
              : "Add maize, beans, coffee, or other tracked crops to compare against market benchmarks."}
          </p>
          {unmatchedRows.length > 0 && (
            <p className="mt-3 text-xs text-amber-300">
              {unmatchedRows.length} item{unmatchedRows.length > 1 ? "s" : ""} not matched to current market price list.
            </p>
          )}
        </div>
      </div>

      <nav className="mt-2 grid grid-cols-5 gap-2 rounded-[18px] border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
        {[
          { label: "Home", active: false, target: "dashboard" as const },
          { label: "Inventory", active: false, target: "inventory" as const },
          { label: "Market", active: true, target: "market" as const },
          { label: "Wallet", active: false, target: "wallet" as const },
          { label: "Profile", active: false, target: "profile" as const },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onNavigate?.(item.target)}
            className={`flex flex-col items-center gap-1 rounded-[14px] px-2 py-2 text-[10px] font-semibold ${
              item.active ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--surface)]">
              {item.label === "Home" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 11l9-7 9 7" />
                  <path d="M5 10v9h14v-9" />
                </svg>
              )}
              {item.label === "Inventory" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 7h18v12H3z" />
                  <path d="M3 11h18" />
                  <path d="M9 7v12" />
                </svg>
              )}
              {item.label === "Market" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 19V5" />
                  <path d="M9 19V9" />
                  <path d="M14 19v-6" />
                  <path d="M19 19v-10" />
                </svg>
              )}
              {item.label === "Wallet" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="6" width="18" height="12" rx="3" />
                  <circle cx="16.5" cy="12" r="1.5" />
                </svg>
              )}
              {item.label === "Profile" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
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

export default FarmerMarket;
