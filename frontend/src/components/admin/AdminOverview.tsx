import { useEffect, useState } from "react";
import { getAdminOverview, type AdminOverviewResponse } from "../../api/admin";
import {
  AdminBottomNav,
  AdminMobileScreen,
  EmptyState,
  HeaderBadge,
  MetricCard,
  SectionCard,
  StatusChip,
  formatAgo,
  formatRwf,
} from "./AdminShell";

interface AdminOverviewProps {
  onNavigate?: (target: string) => void;
  onLogout?: () => void;
}

const OverviewBadgeIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 18h16" />
    <path d="M7 18V9" />
    <path d="M12 18V6" />
    <path d="M17 18v-4" />
  </svg>
);

const HubMap = ({ points }: { points: AdminOverviewResponse["hubActivity"]["locations"] }) => {
  if (!points.length) {
    return (
      <EmptyState
        title="No active hub movement"
        message="Hub throughput appears here once batches and orders move through the selected time window."
      />
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold">Hub Activity Levels</p>
        <StatusChip tone="green">{points.length} active hubs</StatusChip>
      </div>
      <div className="relative mt-4 h-64 overflow-hidden rounded-[18px] border border-[rgba(163,177,155,0.14)] bg-[radial-gradient(circle_at_20%_20%,rgba(73,197,26,0.12),transparent_45%),linear-gradient(180deg,rgba(14,28,17,0.95),rgba(8,18,10,0.9))]">
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(163,177,155,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(163,177,155,0.2)_1px,transparent_1px)] [background-size:44px_44px]" />
        <svg className="absolute inset-0 h-full w-full opacity-12" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M10,78 C18,62 25,64 31,49 C37,35 48,28 62,32 C75,36 82,29 90,20" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[var(--muted)]" />
          <path d="M8,42 C19,40 25,48 36,46 C49,44 55,55 69,60 C78,63 86,61 93,72" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[var(--muted)]" />
        </svg>
        {points.slice(0, 8).map((hub) => {
          const tone = hub.activityLevel === "high" ? "#2cff59" : hub.activityLevel === "medium" ? "#f4ba2a" : "#9aa8a0";
          return (
            <div key={hub.hubId} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${hub.plot.x}%`, top: `${hub.plot.y}%` }}>
              <span className="relative block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: tone, boxShadow: `0 0 0 5px ${tone}1f, 0 0 18px ${tone}` }} />
            </div>
          );
        })}
        <div className="absolute bottom-3 left-3 right-3 grid gap-2 rounded-[14px] border border-[rgba(163,177,155,0.14)] bg-[rgba(7,14,8,0.88)] px-3 py-3 text-xs sm:grid-cols-3">
          {points.slice(0, 3).map((hub) => (
            <div key={hub.hubId} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${hub.activityLevel === "high" ? "bg-[#2cff59]" : hub.activityLevel === "medium" ? "bg-[#f4ba2a]" : "bg-[var(--muted)]"}`} />
              <span className="font-semibold text-[var(--text)]">{hub.hubName}</span>
              <span className="text-[var(--muted)] capitalize">{hub.activityLevel}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
};

const AdminOverview = ({ onNavigate, onLogout }: AdminOverviewProps) => {
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
  const tradeMetric = metricById("trade_volume");
  const escrowMetric = metricById("escrow_locked");
  const accuracyMetric = metricById("ai_accuracy");
  const usersMetric = metricById("active_users");
  const windowOptions = data?.window.options || ["live", "24h", "weekly", "monthly"];
  const hubLocations = data?.hubActivity.locations || [];
  const recentEscalations = data?.recentEscalations || [];
  const badgeTone = loading ? "amber" : data?.hasData ? "green" : "neutral";
  const badgeLabel = loading ? "Syncing" : data?.hasData ? "Live" : "Idle";

  return (
    <AdminMobileScreen>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="m-0 text-[clamp(34px,4.5vw,54px)] font-bold tracking-[-1px]">{data?.header.title || "Nationwide Overview"}</p>
          <p className="m-0 mt-2 text-sm uppercase tracking-[2px] text-[var(--muted)]">{data?.header.subtitle || "Rwanda D2P Command Center"}</p>
        </div>
        <HeaderBadge label={badgeLabel} tone={badgeTone}>
          <OverviewBadgeIcon />
        </HeaderBadge>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {windowOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setWindowKey(option)}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[1px] ${windowKey === option ? "bg-[var(--accent)] text-[#061007]" : "bg-[rgba(255,255,255,0.05)] text-[var(--muted)]"}`}
          >
            {option}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {loading && <p className="mt-4 text-sm text-[var(--muted)] animate-pulse">Loading admin overview...</p>}
      {!loading && !error && !data?.hasData && (
        <div className="mt-4">
          <EmptyState
            title="No marketplace activity in this window"
            message="Switch time windows or wait for orders, funded escrow, and disputes to appear."
          />
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Trade Volume" value={tradeMetric?.display || "0"} unit={tradeMetric?.unit || "RWF"} changePct={tradeMetric?.changePct} />
        <MetricCard label="Escrow Locked" value={escrowMetric?.display || "0"} unit={escrowMetric?.unit || "RWF"} changePct={escrowMetric?.changePct} />
        <MetricCard label="AI Accuracy" value={accuracyMetric?.display || "0%"} changePct={accuracyMetric?.changePct} />
        <MetricCard label="Active Users" value={usersMetric?.display || "0"} changePct={usersMetric?.changePct} />
      </div>

      <div className="mt-5">
        <HubMap points={hubLocations} />
      </div>

      <SectionCard className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm font-semibold">Recent Escalations</p>
          <StatusChip tone={recentEscalations.length ? "green" : "neutral"}>
            {recentEscalations.length ? "Needs review" : "Quiet"}
          </StatusChip>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {recentEscalations.slice(0, 4).map((row) => (
            <div key={row.id} className="rounded-[16px] border border-[rgba(163,177,155,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="m-0 text-sm font-semibold">{row.title}</p>
                  <p className="m-0 mt-1 text-xs uppercase tracking-[1.2px] text-[var(--muted)]">{row.subtitle}</p>
                  <p className="m-0 mt-3 text-sm text-[var(--text)]">{row.issue}</p>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-xs text-[var(--muted)]">{formatAgo(row.occurredAt)}</span>
                  <StatusChip tone={row.severity === "urgent" ? "red" : row.severity === "review" ? "amber" : "green"}>
                    {row.severity}
                  </StatusChip>
                </div>
              </div>
            </div>
          ))}
          {!loading && recentEscalations.length === 0 && (
            <EmptyState
              title="No escalations in this window"
              message="Disputes and payout failures will appear here as soon as they need admin attention."
            />
          )}
        </div>
      </SectionCard>

      <p className="mt-5 mb-0 text-sm text-[var(--muted)]">
        Last synced {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"}
        {escrowMetric ? ` | Escrow locked ${formatRwf(escrowMetric.value)}` : ""}
      </p>

      <AdminBottomNav active="overview" onNavigate={onNavigate} onLogout={onLogout} />
    </AdminMobileScreen>
  );
};

export default AdminOverview;
