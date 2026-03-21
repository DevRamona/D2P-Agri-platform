import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { advanceAdminOrderTracking, getAdminOrderById, type AdminOrderDetailResponse } from "../../api/admin";
import { API_BASE } from "../../api/client";
import { AdminBottomNav, AdminMobileScreen, SectionCard, StatusChip, formatAgo, formatRwf } from "./AdminShell";

interface AdminOrderDetailProps {
  onNavigate?: (target: string) => void;
  onLogout?: () => void;
}

const FALLBACK_IMAGE = "https://placehold.co/600x400?text=Order";

const resolveImageUrl = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE;
  if (image.startsWith("/uploads")) return `${API_BASE}${image}`;
  return image;
};

const stageActionLabel = (stage: string) => {
  if (stage === "farmer_dispatching") return "Start Hub Inspection";
  if (stage === "hub_inspection") return "Release For Delivery";
  return "";
};

const AdminOrderDetail = ({ onNavigate, onLogout }: AdminOrderDetailProps) => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminOrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const result = await getAdminOrderById(id);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Failed to load admin order detail", err);
        if (!cancelled) setError("Unable to load this order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const order = data?.order;
  const timeline = data?.timeline || [];
  const canAdvance = order?.trackingStage === "farmer_dispatching" || order?.trackingStage === "hub_inspection";

  return (
    <AdminMobileScreen>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-[14px] border border-[rgba(163,177,155,0.16)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-xs font-semibold uppercase tracking-[1px] text-[var(--muted)]"
          onClick={() => onNavigate?.("escrow")}
        >
          Back to Escrow
        </button>
        <StatusChip tone={loading ? "amber" : "green"}>{loading ? "Loading" : "Order detail"}</StatusChip>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-[var(--muted)] animate-pulse">Loading order detail...</p>}

      {order && (
        <>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row">
            <SectionCard className="flex-1">
              <p className="m-0 text-xs uppercase tracking-[1.2px] text-[var(--muted)]">
                {order.orderNumber || `Order ${order.id.slice(-6).toUpperCase()}`}
              </p>
              <p className="m-0 mt-2 text-2xl font-bold">{order.title}</p>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">{order.farmerName} to {order.buyerName}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusChip tone="green">{order.escrowStatus}</StatusChip>
                <StatusChip tone="neutral">{order.trackingStage.split("_").join(" ")}</StatusChip>
                <StatusChip tone="amber">{order.paymentMethod}</StatusChip>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="m-0 text-xs uppercase tracking-[1px] text-[var(--muted)]">Contract Value</p>
                  <p className="m-0 mt-2 text-xl font-semibold">{formatRwf(order.totalPrice)}</p>
                </div>
                <div>
                  <p className="m-0 text-xs uppercase tracking-[1px] text-[var(--muted)]">Weight</p>
                  <p className="m-0 mt-2 text-xl font-semibold">{Math.round(order.totalWeight).toLocaleString()} kg</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard className="w-full lg:max-w-[320px]">
              <img
                src={resolveImageUrl(order.image)}
                alt={order.title}
                className="h-44 w-full rounded-[16px] object-cover"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_IMAGE;
                }}
              />
              <p className="m-0 mt-4 text-xs uppercase tracking-[1px] text-[var(--muted)]">Destination Hub</p>
              <p className="m-0 mt-2 text-lg font-semibold">{data?.hub.name}</p>
              <p className="m-0 mt-1 text-sm text-[var(--muted)]">{data?.hub.region}</p>
            </SectionCard>
          </div>

          <SectionCard className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-sm font-semibold">Delivery Timeline</p>
                <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                  Updated {order.trackingUpdatedAt ? formatAgo(order.trackingUpdatedAt) : "just now"}
                </p>
              </div>
              {canAdvance && (
                <button
                  type="button"
                  className="rounded-[14px] bg-[var(--accent)] px-4 py-3 text-xs font-bold uppercase tracking-[1px] text-[#061007] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updating}
                  onClick={async () => {
                    if (!id) return;
                    try {
                      setUpdating(true);
                      setError(null);
                      await advanceAdminOrderTracking(id);
                      const refreshed = await getAdminOrderById(id);
                      setData(refreshed);
                    } catch (err) {
                      console.error("Failed to advance admin tracking", err);
                      setError("Could not update this order stage.");
                    } finally {
                      setUpdating(false);
                    }
                  }}
                >
                  {updating ? "Updating..." : stageActionLabel(order.trackingStage)}
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-5">
              {timeline.map((step, index) => (
                <div key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-10 w-10 place-items-center rounded-full ${
                        step.status === "done"
                          ? "bg-[var(--accent)] text-[#061007]"
                          : step.status === "active"
                            ? "bg-[rgba(73,197,26,0.12)] text-[var(--accent)]"
                            : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {index < timeline.length - 1 && (
                      <span className={`mt-2 h-12 w-1 rounded-full ${step.status === "done" ? "bg-[var(--accent)]" : "bg-[rgba(255,255,255,0.08)]"}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`m-0 text-sm font-semibold ${step.status === "active" ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{step.title}</p>
                    <p className="m-0 mt-1 text-xs text-[var(--muted)]">{step.time}</p>
                    {step.detail && <p className="m-0 mt-2 text-xs text-[var(--muted)]">{step.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard className="mt-5">
            <p className="m-0 text-sm font-semibold">Settlement Snapshot</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="m-0 text-xs uppercase tracking-[1px] text-[var(--muted)]">Deposit</p>
                <p className="m-0 mt-2 text-lg font-semibold">{formatRwf(order.depositAmount)}</p>
              </div>
              <div>
                <p className="m-0 text-xs uppercase tracking-[1px] text-[var(--muted)]">Balance Due</p>
                <p className="m-0 mt-2 text-lg font-semibold">{formatRwf(order.balanceDue)}</p>
              </div>
              <div>
                <p className="m-0 text-xs uppercase tracking-[1px] text-[var(--muted)]">Escrow Release</p>
                <p className="m-0 mt-2 text-lg font-semibold">{order.escrowReleasedAt ? formatAgo(order.escrowReleasedAt) : "Not released"}</p>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      <AdminBottomNav active="escrow" onNavigate={onNavigate} onLogout={onLogout} />
    </AdminMobileScreen>
  );
};

export default AdminOrderDetail;
