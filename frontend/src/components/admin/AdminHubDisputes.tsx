import { useEffect, useState } from "react";
import { getAdminHubDisputes, reviewAdminDispute, type AdminDispute, type AdminHubDisputesResponse } from "../../api/admin";
import { AdminBottomNav, AdminMobileScreen, SearchInput, SectionCard, StatusChip, formatAgo, formatKg } from "./AdminShell";

interface AdminHubDisputesProps {
  onNavigate?: (target: string) => void;
}

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
  const height = 140;
  const values = points.map((p) => p.throughputKg);
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const coords = points.map((p, index) => {
    const x = (index / Math.max(1, points.length - 1)) * width;
    const y = height - ((p.throughputKg - min) / range) * (height - 12) - 6;
    return { x, y };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
        <defs>
          <linearGradient id="trendGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2aff55" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#2aff55" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#trendGlow)" />
        <path d={line} fill="none" stroke="#1bf041" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold tracking-[1px] text-[var(--muted)]">
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
  <div className="rounded-[16px] border border-[rgba(163,177,155,0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.015),rgba(73,197,26,0.03))] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="m-0 text-xl leading-none">◌</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-sm font-semibold">{item.hubName} • ID: {item.orderNumber}</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">Commodity: {item.commodity}</p>
          </div>
          <StatusChip tone={toneForSeverity(item.severity)}>{item.severityLabel}</StatusChip>
        </div>
        <p className="m-0 mt-3 text-[10px] tracking-[1.8px] uppercase text-[var(--muted)]">Issue</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="m-0 text-sm">{item.issue}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview(item)}
            className="shrink-0 rounded-[10px] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[#061007] disabled:opacity-60"
          >
            {busy ? "..." : nextDisputeAction(item).label}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[var(--muted)]">
          <span>AI Grade {item.aiDetectedGrade}</span>
          <span>•</span>
          <span>{item.confidenceScore}%</span>
          <span>•</span>
          <span>{formatAgo(item.updatedAt)}</span>
        </div>
      </div>
    </div>
  </div>
);

const AdminHubDisputes = ({ onNavigate }: AdminHubDisputesProps) => {
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
  const trend = data?.weeklyTrend || [
    { day: "MON", throughputKg: 5200 }, { day: "TUE", throughputKg: 6100 }, { day: "WED", throughputKg: 5400 },
    { day: "THU", throughputKg: 8300 }, { day: "FRI", throughputKg: 9100 }, { day: "SAT", throughputKg: 4800 }, { day: "SUN", throughputKg: 8700 },
  ];

  const handleReviewAction = async (item: AdminDispute) => {
    try {
      setBusyDisputeId(item.id);
      setNotice(null);
      const next = nextDisputeAction(item);
      const result = await reviewAdminDispute(item.id, { action: next.action });
      setNotice(`${item.orderNumber}: ${next.label} -> ${result.dispute.severityLabel}`);
      setReloadTick((v) => v + 1);
    } catch (err) {
      console.error("Failed to update dispute", err);
      setNotice("Failed to update dispute status.");
    } finally {
      setBusyDisputeId(null);
    }
  };

  return (
    <AdminMobileScreen>
      <div className="flex items-center justify-between">
        <div>
          <p className="m-0 text-2xl font-bold">{data?.header.title || "Hub & Disputes"}</p>
          <p className="m-0 text-xs uppercase tracking-[1.8px] text-[var(--muted)]">
            {data?.header.subtitle || "Admin Dashboard • Rwanda Nationwide"}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(163,177,155,0.2)] bg-[rgba(255,255,255,0.03)] text-sm">
          o
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-3 text-sm text-[var(--accent)]">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SectionCard>
          <p className="m-0 text-xs text-[var(--muted)]">Avg. Inspection</p>
          <p className="m-0 mt-2 text-2xl font-bold">{summary?.avgInspectionMinutes ?? 42} mins</p>
          <p className="m-0 mt-2 text-xs font-semibold text-[#ff7474]">{summary?.avgInspectionChangePct ?? -5}%</p>
        </SectionCard>
        <SectionCard>
          <p className="m-0 text-xs text-[var(--muted)]">Dispute Rate</p>
          <p className="m-0 mt-2 text-2xl font-bold">{summary?.disputeRate ?? 2.4}%</p>
          <p className="m-0 mt-2 text-xs font-semibold text-[#2bff5d]">+{summary?.disputeRateChangePct ?? 0.1}%</p>
        </SectionCard>
      </div>

      <SectionCard className="mt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-xs text-[var(--muted)]">Daily Throughput</p>
            <p className="m-0 mt-2 text-2xl font-bold">{summary ? formatKg(summary.dailyThroughputKg) : "12,400 kg"}</p>
          </div>
          <p className="m-0 text-sm font-semibold text-[#1fff4f]">+{summary?.dailyThroughputChangePct ?? 12}%</p>
        </div>
      </SectionCard>

      <SectionCard className="mt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-lg font-semibold">Weekly Trend</p>
            <p className="m-0 text-xs text-[var(--muted)]">National aggregation hubs</p>
          </div>
          <StatusChip tone="green">Live Data</StatusChip>
        </div>
        <div className="mt-3">
          <TrendChart points={trend} />
        </div>
      </SectionCard>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] bg-[rgba(255,255,255,0.03)] p-1">
        <button
          type="button"
          onClick={() => setTab("hub_stats")}
          className={`rounded-[10px] px-3 py-2 text-sm font-semibold ${tab === "hub_stats" ? "bg-[rgba(73,197,26,0.14)] text-[var(--accent)]" : "text-[var(--muted)]"}`}
        >
          Hub Stats
        </button>
        <button
          type="button"
          onClick={() => setTab("quality_disputes")}
          className={`rounded-[10px] px-3 py-2 text-sm font-semibold ${tab === "quality_disputes" ? "bg-[var(--accent)] text-[#061007]" : "text-[var(--muted)]"}`}
        >
          Quality Disputes
        </button>
      </div>

      <div className="mt-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search hubs, crops, or IDs..." trailingLabel="FILTER" />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <p className="m-0 tracking-[2px] uppercase">{tab === "quality_disputes" ? `Unresolved (${data?.unresolvedCount ?? 0})` : "Hub Stats"}</p>
        <p className="m-0">Last update: {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"}</p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {loading && <p className="m-0 text-sm text-[var(--muted)] animate-pulse">Loading hub disputes...</p>}
        {!loading && tab === "quality_disputes" && (data?.disputes.length || 0) === 0 && (
          <p className="m-0 text-sm text-[var(--muted)]">No disputes found for the current filter.</p>
        )}
        {!loading && tab === "quality_disputes" && (data?.disputes || []).slice(0, 4).map((item) => (
          <DisputeCard
            key={item.id}
            item={item}
            busy={busyDisputeId === item.id}
            onReview={handleReviewAction}
          />
        ))}
        {!loading && tab === "hub_stats" && (data?.hubStats || []).slice(0, 6).map((hub) => (
          <SectionCard key={hub.hubId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-sm font-semibold">{hub.hubName}</p>
                <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{hub.region} • {hub.hubId}</p>
              </div>
              <StatusChip tone={hub.activeDisputes > 0 ? "amber" : "green"}>{hub.activeDisputes} disputes</StatusChip>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><p className="m-0 text-[var(--muted)]">Throughput</p><p className="m-0 mt-1 font-semibold">{formatKg(hub.throughputKg)}</p></div>
              <div><p className="m-0 text-[var(--muted)]">Batches</p><p className="m-0 mt-1 font-semibold">{hub.batchCount}</p></div>
              <div><p className="m-0 text-[var(--muted)]">Inspection</p><p className="m-0 mt-1 font-semibold">{hub.inspectionMinutes}m</p></div>
            </div>
          </SectionCard>
        ))}
      </div>

      <AdminBottomNav active="hubs" onNavigate={onNavigate} />
    </AdminMobileScreen>
  );
};

export default AdminHubDisputes;

