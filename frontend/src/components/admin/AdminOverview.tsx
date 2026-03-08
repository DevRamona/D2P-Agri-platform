import { useEffect, useState } from "react";
import { getAdminOverview, type AdminOverviewResponse } from "../../api/admin";
import {
  AdminBottomNav,
  AdminMobileScreen,
  MetricCard,
  SectionCard,
  StatusChip,
  formatAgo,
  formatRwf,
} from "./AdminShell";

interface AdminOverviewProps {
  onNavigate?: (target: string) => void;
}

const HubMap = ({ points }: { points: AdminOverviewResponse["hubActivity"]["locations"] }) => (
  <SectionCard>
    <div className="flex items-center justify-between">
      <p className="m-0 text-sm font-semibold">Hub Activity Levels</p>
      <button type="button" className="text-xs font-semibold text-[var(--accent)]">
        View Districts
      </button>
    </div>
    <div className="relative mt-3 h-56 overflow-hidden rounded-[16px] border border-[rgba(163,177,155,0.14)] bg-[radial-gradient(circle_at_20%_20%,rgba(73,197,26,0.12),transparent_45%),linear-gradient(180deg,rgba(14,28,17,0.95),rgba(8,18,10,0.9))]">
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(163,177,155,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(163,177,155,0.2)_1px,transparent_1px)] [background-size:28px_28px]" />
      <svg className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M10,78 C18,62 25,64 31,49 C37,35 48,28 62,32 C75,36 82,29 90,20" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[var(--muted)]" />
        <path d="M8,42 C19,40 25,48 36,46 C49,44 55,55 69,60 C78,63 86,61 93,72" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[var(--muted)]" />
      </svg>
      {points.slice(0, 7).map((hub) => {
        const tone = hub.activityLevel === "high" ? "#2cff59" : hub.activityLevel === "medium" ? "#f4ba2a" : "#9aa8a0";
        return (
          <div key={hub.hubId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${hub.plot.x}%`, top: `${hub.plot.y}%` }}>
            <span className="relative block h-3 w-3 rounded-full" style={{ backgroundColor: tone, boxShadow: `0 0 0 4px ${tone}22, 0 0 18px ${tone}` }} />
          </div>
        );
      })}
      <div className="absolute bottom-3 left-3 rounded-[12px] border border-[rgba(163,177,155,0.14)] bg-[rgba(7,14,8,0.85)] px-3 py-2 text-xs">
        {points.slice(0, 2).map((hub) => (
          <div key={hub.hubId} className="flex items-center gap-2 py-0.5">
            <span className={`h-2 w-2 rounded-full ${hub.activityLevel === "high" ? "bg-[#2cff59]" : hub.activityLevel === "medium" ? "bg-[#f4ba2a]" : "bg-[var(--muted)]"}`} />
            <span className="text-[var(--text)]">{hub.hubName}</span>
            <span className="text-[var(--muted)] capitalize">{hub.activityLevel}</span>
          </div>
        ))}
      </div>
    </div>
  </SectionCard>
);

const AdminOverview = ({ onNavigate }: AdminOverviewProps) => {
  const [windowKey, setWindowKey] = useState("live");
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getAdminOverview(windowKey);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Failed to load admin overview", err);
        if (!cancelled) setError("Unable to load admin overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [windowKey]);

  const metrics = data?.metrics || [];
  const metricById = (id: string) => metrics.find((m) => m.id === id);

  return (
    <AdminMobileScreen>
      <div className="flex items-center justify-between">
        <div>
          <p className="m-0 text-2xl font-bold">{data?.header.title || "Nationwide Overview"}</p>
          <p className="m-0 text-sm text-[var(--muted)]">{data?.header.subtitle || "Rwanda D2P Command Center"}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(163,177,155,0.2)] bg-[rgba(255,255,255,0.03)]">
          <span className="text-lg">🔔</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(data?.window.options || ["live", "24h", "weekly", "monthly"]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setWindowKey(option)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${windowKey === option ? "bg-[var(--accent)] text-[#061007]" : "bg-[rgba(255,255,255,0.05)] text-[var(--muted)]"}`}
          >
            {option}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {loading && <p className="mt-3 text-sm text-[var(--muted)] animate-pulse">Loading admin overview...</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Trade Volume" value={metricById("trade_volume")?.display || "1.2B"} unit={metricById("trade_volume")?.unit || "RWF"} changePct={metricById("trade_volume")?.changePct} />
        <MetricCard label="Escrow Locked" value={metricById("escrow_locked")?.display || "450M"} unit={metricById("escrow_locked")?.unit || "RWF"} changePct={metricById("escrow_locked")?.changePct} />
        <MetricCard label="AI Accuracy" value={metricById("ai_accuracy")?.display || "94.2%"} changePct={metricById("ai_accuracy")?.changePct} />
        <MetricCard label="Active Users" value={metricById("active_users")?.display || "12.4k"} changePct={metricById("active_users")?.changePct} />
      </div>

      <div className="mt-4">
        <HubMap points={data?.hubActivity.locations || []} />
      </div>

      <SectionCard className="mt-4">
        <div className="flex items-center justify-between">
          <p className="m-0 text-sm font-semibold">Recent Escalations</p>
          <StatusChip tone="green">Live</StatusChip>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {(data?.recentEscalations || []).slice(0, 4).map((row) => (
            <div key={row.id} className="rounded-[14px] border border-[rgba(163,177,155,0.12)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-sm font-semibold">{row.title}</p>
                  <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{row.subtitle}</p>
                  <p className="m-0 mt-2 text-xs text-[var(--muted)]">{row.issue}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs text-[var(--muted)]">{formatAgo(row.occurredAt)}</span>
                  <StatusChip tone={row.severity === "urgent" ? "red" : row.severity === "review" ? "amber" : "green"}>
                    {row.severity}
                  </StatusChip>
                </div>
              </div>
            </div>
          ))}
          {(!data || data.recentEscalations.length === 0) && !loading && (
            <p className="m-0 text-sm text-[var(--muted)]">No escalations available yet.</p>
          )}
        </div>
      </SectionCard>

      <p className="mt-3 mb-0 text-center text-xs text-[var(--muted)]">
        Last synced: {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"} • {metricById("escrow_locked") ? formatRwf(metricById("escrow_locked")!.value) : ""}
      </p>

      <AdminBottomNav active="overview" onNavigate={onNavigate} />
    </AdminMobileScreen>
  );
};

export default AdminOverview;

