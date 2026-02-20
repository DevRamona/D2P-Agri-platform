import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ViewMode } from "../types";
import { getBatchById, type Batch, type Product } from "../api/farmer";

interface BatchTrackerProps {
  onNavigate?: (view: ViewMode) => void;
}

const BatchTracker = ({ onNavigate }: BatchTrackerProps) => {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatch = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const result = await getBatchById(id);
        // Cast to any because the generic type in api/farmer.ts might be wrapping it incorrectly as { data: Batch }
        // when it actually returns Batch. Or verify types.
        // Based on client.ts, it returns json.data.
        // If farmer.ts says apiFetch<{data: Batch}>, then TS thinks it returns {data: Batch}.
        // But runtime it returns Batch.
        // So 'result' (typed as {data: Batch}) is actually Batch.
        // So we should just use result as Batch.
        setBatch(result as unknown as Batch);
      } catch (err) {
        console.error("Failed to fetch batch:", err);
        setError("Failed to load batch details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [id]);

  if (loading) {
    return (
      <div className="w-full max-w-[520px] h-screen grid place-items-center text-[var(--muted)]">
        <p className="animate-pulse">Loading tracker...</p>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="w-full max-w-[520px] py-12 text-center text-[var(--muted)]">
        <p>{error || "Batch not found"}</p>
        <button
          onClick={() => onNavigate?.("dashboard")}
          className="mt-4 text-[var(--accent)] font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Calculate percentages and statuses based on real data
  // For now, mapping some fields to the UI visualization
  const totalValue = batch.totalPrice;
  // Mocking payment progress as it's not yet in the Batch model
  const advancePayment = totalValue * 0.6;
  const escrowValue = totalValue * 0.4;

  // Get crop type from first product
  const mainCrop = (batch.products[0]?.product as Product)?.name || "Mix";
  const hubLocation = (batch as any).destination || "Kigali Central Hub"; // fall back if destination missing

  return (
    <section className="w-full max-w-[520px] flex flex-col gap-6 animate-[rise_0.6s_ease_both] pb-8">
      <header className="flex items-center justify-between">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          onClick={() => onNavigate?.("dashboard")}
          aria-label="Go back"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="m-0 text-base font-semibold">
          {batch.status === 'active' ? 'Batch Details' : `Batch #${batch._id.slice(-6).toUpperCase()} Tracker`}
        </p>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
          aria-label="Help"
        >
          <span className="text-sm font-semibold">?</span>
        </button>
      </header>

      {/* ACTIVE (UNSOLD) BATCH VIEW */}
      {batch.status === 'active' && (
        <>
          <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--stroke)] p-5 text-[var(--text)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                Listing Active
              </span>
              <span className="text-xs text-[var(--muted)]">{new Date(batch.createdAt).toLocaleDateString()}</span>
            </div>

            <h2 className="text-3xl font-bold mb-1">{mainCrop}</h2>
            <p className="text-[var(--muted)] text-sm mb-6">{batch.totalWeight.toLocaleString()} kg • {hubLocation}</p>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-2)]">
                <span className="text-sm font-medium">Listing Price</span>
                <span className="text-lg font-bold">{totalValue.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-[var(--surface-2)]">
                <span className="text-sm font-medium">Composition</span>
                <span className="text-sm">{batch.products.length} Product(s)</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--stroke)]">
              <div className="flex items-center gap-3 text-[var(--muted)]">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-[var(--text)]">Waiting for Buyer</p>
                  <p>Your batch is visible on the marketplace.</p>
                </div>
              </div>
            </div>
          </div>

          <button className="w-full rounded-[16px] bg-[var(--surface-2)] px-4 py-4 text-sm font-semibold text-[var(--text)]">
            Edit Batch Details
          </button>

          <button className="w-full rounded-[16px] border border-red-200 bg-red-50 dark:bg-red-900/10 px-4 py-4 text-sm font-semibold text-red-600">
            Cancel Listing
          </button>
        </>
      )}

      {/* SOLD BATCH VIEW (Existing Payment Tracker) */}
      {batch.status !== 'active' && (
        <>
          <div className="rounded-[22px] bg-[var(--accent)] p-5 text-[#0b1307] shadow-[0_16px_28px_rgba(73,197,26,0.3)]">
            <div className="flex items-center justify-between">
              <p className="m-0 text-xs font-semibold uppercase tracking-[2px] text-[#0b1307]/80">Total Contract Value</p>
              <span className="rounded-full bg-black/15 px-3 py-1 text-xs font-semibold">{mainCrop}</span>
            </div>
            <p className="mt-3 text-3xl font-bold">{totalValue.toLocaleString()} RWF</p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
                <path d="M9 9h6" />
              </svg>
              {hubLocation}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="m-0 text-lg font-semibold">Payment Progress</h3>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              60% Released
            </span>
          </div>

          <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
            <div className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent)] text-[#0b1307]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                </div>
                <span className="mt-2 h-20 w-1 rounded-full bg-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold">60% Advance Payment</p>
                  <span className="text-xs font-semibold text-[var(--accent)]">Received</span>
                </div>
                <p className="mt-2 text-2xl font-bold">{advancePayment.toLocaleString()} RWF</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Transferred to Mobile Money</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M8 3v4" />
                    <path d="M16 3v4" />
                  </svg>
                  {new Date(batch.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="mt-6 relative flex gap-4">
              <div className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6l3 3" />
                  </svg>
                </div>
                <span className="mt-2 h-20 w-1 rounded-full bg-[var(--surface-2)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="m-0 text-sm font-semibold">40% Quality Retention</p>
                  <span className="text-xs font-semibold text-amber-300">Pending Hub</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-[var(--muted)]">{escrowValue.toLocaleString()} RWF</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Held in secure escrow account</p>
                <div className="mt-4 rounded-[16px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-200">
                  Funds will be released upon completion of moisture content and quality validation.
                </div>
              </div>
            </div>

            <div className="mt-6 relative flex gap-4 opacity-60">
              <div className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M12 6v6l4 2" />
                    <path d="M12 2a10 10 0 1 0 10 10" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <p className="m-0 text-sm font-semibold">Payout Completion</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Batch settlement finalized</p>
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--stroke)] bg-[var(--surface)] p-5">
            <div className="flex items-center justify-between">
              <p className="m-0 text-sm font-semibold">Escrow Release Status</p>
              <span className="text-lg font-bold text-[var(--accent)]">60%</span>
            </div>
            <div className="mt-4 h-3 w-full rounded-full bg-[var(--surface-2)]">
              <div className="h-3 w-[60%] rounded-full bg-[var(--accent)]" />
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">{advancePayment.toLocaleString()} RWF of {totalValue.toLocaleString()} RWF released</p>
          </div>

          <div className="rounded-[22px] border border-[var(--stroke)] bg-[linear-gradient(140deg,#0f1c36,rgba(15,28,54,0.35))] p-5 text-white">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between text-white/70">
                <span>Batch ID</span>
                <span className="text-white">#{batch._id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>Quantity Delivered</span>
                <span className="text-white">{batch.totalWeight.toLocaleString()} KG</span>
              </div>
              <div className="flex items-center justify-between text-white/70">
                <span>Inspection Status</span>
                <span className="text-[var(--accent)]">In Progress</span>
              </div>
            </div>
          </div>

          <button className="w-full rounded-[16px] bg-white px-4 py-4 text-sm font-semibold text-[#0b1307] shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
            Contact Support for Batch #{batch._id.slice(-6).toUpperCase()}
          </button>
        </>
      )}

    </section>
  );
};

export default BatchTracker;
