import { useEffect, useState } from "react";
import { getAdminEscrowAudit, releaseAdminBatchPayouts, type AdminEscrowAuditResponse, type EscrowLedgerItem } from "../../api/admin";
import { AdminBottomNav, AdminMobileScreen, EmptyState, HeaderBadge, SearchInput, SectionCard, StatusChip, formatAgo, formatRwf } from "./AdminShell";

interface AdminEscrowAuditProps {
  onNavigate?: (target: string) => void;
  onLogout?: () => void;
}

const EscrowBadgeIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l7 4v5c0 4.7-2.7 7.9-7 9-4.3-1.1-7-4.3-7-9V7l7-4z" />
    <path d="M9.5 12.5l1.7 1.7 3.8-4" />
  </svg>
);

const statusTone = (status: string): "green" | "amber" | "red" | "neutral" => {
  if (status === "released") return "green";
  if (status === "escrowed") return "amber";
  if (status === "discrepancy") return "red";
  return "neutral";
};

const LedgerCard = ({
  item,
  onView,
}: {
  item: EscrowLedgerItem;
  onView?: (item: EscrowLedgerItem) => void;
}) => (
  <div className="rounded-[18px] border border-[rgba(163,177,155,0.14)] bg-[linear-gradient(180deg,rgba(7,23,11,0.96),rgba(9,28,14,0.92))] p-4">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="m-0 text-xs uppercase tracking-[1.2px] text-[var(--muted)]">{item.transactionId}</p>
        <p className="m-0 mt-2 text-xl font-semibold">{item.title}</p>
        <p className="m-0 mt-1 text-xs text-[var(--muted)]">{item.farmerName} to {item.buyerName}</p>
      </div>
      <StatusChip tone={statusTone(item.status)}>{item.status}</StatusChip>
    </div>

    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Total Amount</p>
        <p className={`m-0 mt-2 text-2xl font-bold ${item.status === "discrepancy" ? "text-[#ff6767]" : "text-[var(--text)]"}`}>
          {formatRwf(item.totalAmount)}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Hub</p>
        <p className="m-0 mt-2 text-lg font-semibold text-[var(--text)]">{item.hubId}</p>
        <p className="m-0 mt-1 text-xs text-[var(--muted)]">{item.region}</p>
      </div>
    </div>

    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">{item.farmerPayoutPercent}% farmer payout</span>
        <span className="font-semibold text-[#2eff63]">{formatRwf(item.farmerPayoutAmount)}</span>
      </div>
      <div className="h-2 rounded-full bg-[rgba(163,177,155,0.14)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${item.farmerPayoutPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{item.auditReservePercent}% reserve and audit</span>
        <span>{formatRwf(item.auditReserveAmount)}</span>
      </div>
      {item.discrepancyReason && <p className="m-0 mt-3 text-xs text-[#ff8f8f]">{item.discrepancyReason}</p>}
      <button
        type="button"
        className="mt-4 rounded-[12px] border border-[rgba(163,177,155,0.16)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs font-semibold text-[var(--text)]"
        onClick={() => onView?.(item)}
      >
        View Order
      </button>
    </div>
  </div>
);

const AdminEscrowAudit = ({ onNavigate, onLogout }: AdminEscrowAuditProps) => {
  const [data, setData] = useState<AdminEscrowAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [processingRelease, setProcessingRelease] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getAdminEscrowAudit({ q: query, region: activeRegion, status: activeStatus });
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Failed to load escrow audit", err);
        if (!cancelled) setError("Unable to load escrow ledger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, activeRegion, activeStatus]);

  const summary = data?.summary;
  const regions = ["all", ...(data?.filters.availableRegions || [])];
  const statuses = data?.filters.availableStatuses || ["all", "escrowed", "released", "discrepancy", "pending"];
  const filterActive = Boolean(query) || activeRegion !== "all" || activeStatus !== "all";
  const readyCount = summary?.eligibleBatchPayoutCount || 0;
  const badgeTone = processingRelease ? "amber" : readyCount > 0 ? "green" : "neutral";
  const badgeLabel = processingRelease ? "Processing" : readyCount > 0 ? `${readyCount} ready` : data?.hasData ? "Synced" : "Idle";

  return (
    <AdminMobileScreen>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="m-0 text-[clamp(34px,4.5vw,54px)] font-bold tracking-[-1px]">{data?.header.title || "Escrow & Audit"}</p>
          <p className="m-0 mt-2 text-sm uppercase tracking-[2px] text-[var(--muted)]">
            {(data?.header.subtitle || "Live ledger")} | Last sync {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"}
          </p>
        </div>
        <HeaderBadge label={badgeLabel} tone={badgeTone}>
          <EscrowBadgeIcon />
        </HeaderBadge>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-4 text-sm text-[var(--accent)]">{notice}</p>}
      {loading && <p className="mt-4 text-sm text-[var(--muted)] animate-pulse">Loading escrow ledger...</p>}
      {!loading && !error && !data?.hasData && (
        <div className="mt-4">
          <EmptyState
            title="No escrow activity yet"
            message="Funded orders and payout audits will appear here once marketplace payments start moving."
          />
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <SectionCard className="bg-[linear-gradient(135deg,rgba(73,197,26,0.88),rgba(39,164,14,0.9))] text-[#071206]">
          <p className="m-0 text-xs uppercase tracking-[1.1px] opacity-80">Total in Escrow</p>
          <p className="m-0 mt-3 text-[clamp(28px,4vw,40px)] font-bold">{formatRwf(summary?.totalInEscrow || 0)}</p>
          <p className="m-0 mt-3 text-xs font-semibold">{summary?.pendingBatchCount || 0} batches currently locked</p>
        </SectionCard>
        <SectionCard className="bg-[rgba(9,24,12,0.92)]">
          <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">Pending Payouts</p>
          <p className="m-0 mt-3 text-[clamp(28px,4vw,40px)] font-bold">{formatRwf(summary?.pendingPayouts || 0)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip tone="green">{readyCount} ready</StatusChip>
            <StatusChip tone={summary?.discrepancyCount ? "red" : "neutral"}>{summary?.discrepancyCount || 0} discrepancies</StatusChip>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5">
        <SearchInput value={query} onChange={setQuery} placeholder="Search transaction ID, title, farmer, buyer, or hub..." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {regions.map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => setActiveRegion(region.toLowerCase())}
            className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[1px] ${activeRegion === region.toLowerCase() ? "border border-[rgba(73,197,26,0.28)] bg-[rgba(73,197,26,0.12)] text-[var(--accent)]" : "border border-[rgba(163,177,155,0.16)] text-[var(--muted)]"}`}
          >
            {region}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[1px] ${activeStatus === status ? "border border-[rgba(121,139,176,0.22)] bg-[rgba(16,31,20,0.95)] text-[var(--text)]" : "border border-[rgba(163,177,155,0.16)] text-[var(--muted)]"}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold uppercase tracking-[2px] text-[var(--muted)]">Transaction Ledger</p>
        <StatusChip tone="green">Secure audit</StatusChip>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {(data?.ledger || []).slice(0, 6).map((item) => (
          <LedgerCard
            key={item.id}
            item={item}
            onView={(selected) => {
              if (selected.orderId) {
                onNavigate?.(`orders/${selected.orderId}`);
              }
            }}
          />
        ))}
        {!loading && (data?.ledger.length || 0) === 0 && (
          <EmptyState
            title={filterActive ? "No ledger entries match these filters" : "No ledger entries yet"}
            message={filterActive ? "Adjust the search or status filters to widen the result set." : "Orders funded into escrow will appear here once buyers start paying deposits."}
          />
        )}
      </div>

      <SectionCard className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="m-0 text-sm font-semibold">Payout Audit Trail</p>
          <StatusChip tone={(data?.recentPayoutAudits.length || 0) > 0 ? "green" : "neutral"}>
            {(data?.recentPayoutAudits.length || 0) > 0 ? "Live" : "Waiting"}
          </StatusChip>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {(data?.recentPayoutAudits || []).slice(0, 5).map((audit) => (
            <div key={audit.id} className="rounded-[14px] border border-[rgba(163,177,155,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="m-0 text-xs uppercase tracking-[1.1px] text-[var(--muted)]">{audit.provider} | {audit.method}</p>
                  <p className="m-0 mt-2 text-sm font-semibold">{formatRwf(audit.amount)}</p>
                  <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                    {audit.externalReference ? `Ref ${audit.externalReference}` : "No external reference"} | {audit.executionMode}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                  <span className="text-xs text-[var(--muted)]">{formatAgo(audit.processedAt)}</span>
                  <StatusChip tone={audit.status === "succeeded" ? "green" : audit.status === "failed" ? "red" : "amber"}>
                    {audit.status}
                  </StatusChip>
                </div>
              </div>
              {audit.errorMessage && <p className="m-0 mt-3 text-xs text-[#ff8a8a]">{audit.errorMessage}</p>}
            </div>
          ))}
          {!loading && (data?.recentPayoutAudits.length || 0) === 0 && (
            <EmptyState
              title="No payout audits recorded"
              message="Completed or failed payout attempts will be logged here with provider references."
            />
          )}
        </div>
      </SectionCard>

      <button
        type="button"
        className="mt-5 w-full rounded-[18px] bg-[var(--accent)] px-4 py-4 text-sm font-bold text-[#061007] shadow-[0_10px_28px_rgba(73,197,26,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={processingRelease || readyCount === 0}
        onClick={async () => {
          try {
            setProcessingRelease(true);
            setNotice(null);
            const result = await releaseAdminBatchPayouts(10);
            setNotice(`${result.message} (${result.mode})`);
            const refreshed = await getAdminEscrowAudit({ q: query, region: activeRegion, status: activeStatus });
            setData(refreshed);
          } catch (err) {
            console.error("Failed to release batch payouts", err);
            setNotice("Failed to release batch payouts.");
          } finally {
            setProcessingRelease(false);
          }
        }}
      >
        {processingRelease ? "Releasing funded payouts..." : readyCount > 0 ? `Release ${readyCount} funded payout${readyCount === 1 ? "" : "s"}` : "No funded payouts ready"}
      </button>

      <AdminBottomNav active="escrow" onNavigate={onNavigate} onLogout={onLogout} />
    </AdminMobileScreen>
  );
};

export default AdminEscrowAudit;
