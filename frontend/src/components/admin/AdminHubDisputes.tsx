import { useEffect, useState } from "react";
import { getAdminHubDisputes, reviewAdminDispute, type AdminDispute, type AdminHubDisputesResponse } from "../../api/admin";
import { AdminBottomNav, AdminMobileScreen, EmptyState, HeaderBadge, SearchInput, SectionCard, StatusChip, formatAgo, formatKg } from "./AdminShell";

interface AdminHubDisputesProps {
  onNavigate?: (target: string) => void;
  onLogout?: () => void;
}

const HubsBadgeIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="6" cy="8" r="2.2" />
    <circle cx="18" cy="8" r="2.2" />
    <circle cx="12" cy="17" r="2.2" />
    <path d="M7.7 9.5l2.8 5.1M16.3 9.5l-2.8 5.1M8.4 8h7.2" />
  </svg>
);

const toneForSeverity = (severity: string): "red" | "amber" | "green" | "neutral" => {
  if (severity === "high") return "red";
  if (severity === "medium") return "amber";
  if (severity === "low") return "green";
  return "neutral";
};

const nextDisputeAction = (item: AdminDispute) => {
  if (item.reviewState === "under review") return { action: "resolve", label: "Resolve" };
  if (item.reviewState === "resolved" || item.reviewState === "dismissed") return { action: "reopen", label: "Reopen" };
  return { action: "start_review", label: "Review" };
};

const TrendChart = ({ points }: { points: Array<{ day: string; throughputKg: number }> }) => {
  const width = 320;
  const height = 150;
  const values = points.map((p) => p.throughputKg);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const coords = points.map((p, index) => {
    const x = (index / Math.max(1, points.length - 1)) * width;
    const y = height - ((p.throughputKg - min) / range) * (height - 16) - 8;
    return { x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        <defs>
          <linearGradient id="hubTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2aff55" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2aff55" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#hubTrendFill)" />
        <path d={line} fill="none" stroke="#1bf041" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[1px] text-[var(--muted)]">
        {points.map((p) => (
          <span key={p.day}>{p.day}</span>
        ))}
      </div>
    </div>
  );
};

const DisputeCard = ({
  item,
  busy,
  onReview,
}: {
  item: AdminDispute;
  busy: boolean;
  onReview: (item: AdminDispute) => void;
}) => (
  <div className="rounded-[18px] border border-[rgba(163,177,155,0.14)] bg-[linear-gradient(180deg,rgba(7,22,11,0.95),rgba(9,24,12,0.92))] p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(163,177,155,0.18)] bg-[rgba(255,255,255,0.03)]">
          <span className="h-2.5 w-2.5 rounded-full bg-current text-[var(--accent)]" />
        </span>
        <div>
          <p className="m-0 text-sm font-semibold">{item.hubName} | {item.orderNumber}</p>
          <p className="m-0 mt-1 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Commodity {item.commodity}</p>
        </div>
      </div>
      <StatusChip tone={toneForSeverity(item.severity)}>{item.severityLabel}</StatusChip>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
      <div>
        <p className="m-0 text-[10px] uppercase tracking-[1.6px] text-[var(--muted)]">Issue</p>
        <p className="m-0 mt-2 text-base text-[var(--text)]">{item.issue}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
          <span>AI grade {item.aiDetectedGrade}</span>
          <span>{item.confidenceScore}% confidence</span>
          <span>{formatAgo(item.updatedAt)}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onReview(item)}
        className="rounded-[12px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#061007] disabled:opacity-60"
      >
        {busy ? "Working..." : nextDisputeAction(item).label}
      </button>
    </div>
  </div>
);

const AdminHubDisputes = ({ onNavigate, onLogout }: AdminHubDisputesProps) => {
  const [data, setData] = useState<AdminHubDisputesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"quality_disputes" | "hub_stats">("quality_disputes");
  const [busyDisputeId, setBusyDisputeId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getAdminHubDisputes({ q: query, tab });
        if (!cancelled) {
          setData(result);
          setTab(result.tabs.active === "hub_stats" ? "hub_stats" : "quality_disputes");
        }
      } catch (err) {
        console.error("Failed to load admin hub disputes", err);
        if (!cancelled) setError("Unable to load hub disputes dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tab, reloadTick]);

  const summary = data?.summary;
  const trend = data?.weeklyTrend || [];
  const hasTrendData = trend.some((point) => point.throughputKg > 0);
  const disputes = data?.disputes || [];
  const hubStats = data?.hubStats || [];
  const badgeTone = loading ? "amber" : disputes.length ? "green" : "neutral";
  const badgeLabel = loading ? "Syncing" : disputes.length ? `${disputes.length} open` : data?.hasData ? "Clear" : "Idle";

  const handleReviewAction = async (item: AdminDispute) => {
    try {
      setBusyDisputeId(item.id);
      setNotice(null);
      const next = nextDisputeAction(item);
      const result = await reviewAdminDispute(item.id, { action: next.action });
      setNotice(`${item.orderNumber}: ${next.label} updated to ${result.dispute.severityLabel}.`);
      setReloadTick((value) => value + 1);
    } catch (err) {
      console.error("Failed to update dispute", err);
      setNotice("Failed to update dispute status.");
    } finally {
      setBusyDisputeId(null);
    }
  };

  return (
    <AdminMobileScreen>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="m-0 text-[clamp(34px,4.5vw,54px)] font-bold tracking-[-1px]">{data?.header.title || "Hub & Disputes"}</p>
          <p className="m-0 mt-2 text-sm uppercase tracking-[2px] text-[var(--muted)]">{data?.header.subtitle || "Admin Dashboard | Rwanda Nationwide"}</p>
        </div>
        <HeaderBadge label={badgeLabel} tone={badgeTone}>
          <HubsBadgeIcon />
        </HeaderBadge>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-4 text-sm text-[var(--accent)]">{notice}</p>}
      {loading && <p className="mt-4 text-sm text-[var(--muted)] animate-pulse">Loading hub disputes...</p>}
      {!loading && !error && !data?.hasData && (
        <div className="mt-4">
          <EmptyState
            title="No dispute or hub activity yet"
            message="Throughput trends, inspection metrics, and quality disputes will appear here once live marketplace activity starts."
          />
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard>
          <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Avg. Inspection</p>
          <p className="m-0 mt-3 text-[clamp(28px,4vw,40px)] font-bold">{summary?.avgInspectionMinutes || 0} mins</p>
        </SectionCard>
        <SectionCard>
          <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Dispute Rate</p>
          <p className="m-0 mt-3 text-[clamp(28px,4vw,40px)] font-bold">{summary?.disputeRate || 0}%</p>
        </SectionCard>
        <SectionCard className="md:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Daily Throughput</p>
              <p className="m-0 mt-3 text-[clamp(28px,4vw,40px)] font-bold">{formatKg(summary?.dailyThroughputKg || 0)}</p>
            </div>
            <StatusChip tone={summary?.dailyThroughputChangePct ? "green" : "neutral"}>
              {summary?.dailyThroughputChangePct ? `${summary.dailyThroughputChangePct > 0 ? "+" : ""}${summary.dailyThroughputChangePct}%` : "0%"}
            </StatusChip>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="m-0 text-lg font-semibold">Weekly Trend</p>
            <p className="m-0 mt-1 text-sm text-[var(--muted)]">National aggregation hubs</p>
          </div>
          <StatusChip tone={hasTrendData ? "green" : "neutral"}>{hasTrendData ? "Live data" : "No trend"}</StatusChip>
        </div>
        <div className="mt-4">
          {hasTrendData ? (
            <TrendChart points={trend} />
          ) : (
            <EmptyState
              title="No throughput recorded in the last 7 days"
              message="Recent order creation will populate the weekly throughput trend automatically."
            />
          )}
        </div>
      </SectionCard>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-[16px] bg-[rgba(255,255,255,0.03)] p-1">
        <button
          type="button"
          onClick={() => setTab("hub_stats")}
          className={`rounded-[12px] px-3 py-3 text-sm font-semibold ${tab === "hub_stats" ? "bg-[rgba(73,197,26,0.14)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
        >
          Hub Stats
        </button>
        <button
          type="button"
          onClick={() => setTab("quality_disputes")}
          className={`rounded-[12px] px-3 py-3 text-sm font-semibold ${tab === "quality_disputes" ? "bg-[var(--accent)] text-[#061007]" : "text-[var(--muted)]"}`}
        >
          Quality Disputes
        </button>
      </div>

      <div className="mt-4">
        <SearchInput value={query} onChange={setQuery} placeholder={tab === "hub_stats" ? "Search hubs, IDs, or regions..." : "Search disputes, crops, or order IDs..."} />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <p className="m-0 uppercase tracking-[2px]">
          {tab === "quality_disputes" ? `Open disputes (${data?.unresolvedCount || 0})` : "Hub health"}
        </p>
        <p className="m-0">Last update {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {tab === "quality_disputes" && disputes.slice(0, 6).map((item) => (
          <DisputeCard
            key={item.id}
            item={item}
            busy={busyDisputeId === item.id}
            onReview={handleReviewAction}
          />
        ))}

        {!loading && tab === "quality_disputes" && disputes.length === 0 && (
          <EmptyState
            title={query ? "No disputes match this search" : "No active disputes"}
            message={query ? "Try a broader search query or switch to hub stats." : "Quality disputes will appear here as soon as they are created or escalated."}
          />
        )}

        {tab === "hub_stats" && hubStats.slice(0, 8).map((hub) => (
          <SectionCard key={hub.hubId}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="m-0 text-sm font-semibold">{hub.hubName}</p>
                <p className="m-0 mt-1 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">{hub.region} | {hub.hubId}</p>
              </div>
              <StatusChip tone={hub.activeDisputes > 0 ? "amber" : "green"}>{hub.activeDisputes} active disputes</StatusChip>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Throughput</p>
                <p className="m-0 mt-2 font-semibold">{formatKg(hub.throughputKg)}</p>
              </div>
              <div>
                <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Batches</p>
                <p className="m-0 mt-2 font-semibold">{hub.batchCount}</p>
              </div>
              <div>
                <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Inspection</p>
                <p className="m-0 mt-2 font-semibold">{hub.inspectionMinutes} mins</p>
              </div>
            </div>
          </SectionCard>
        ))}

        {!loading && tab === "hub_stats" && hubStats.length === 0 && (
          <EmptyState
            title={query ? "No hubs match this search" : "No hub stats available"}
            message={query ? "Try a broader search query or switch back to disputes." : "Hub throughput and inspection metrics will appear once batches move through aggregation centers."}
          />
        )}
      </div>

      <AdminBottomNav active="hubs" onNavigate={onNavigate} onLogout={onLogout} />
    </AdminMobileScreen>
  );
};

export default AdminHubDisputes;
