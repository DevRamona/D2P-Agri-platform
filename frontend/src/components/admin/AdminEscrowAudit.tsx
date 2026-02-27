import { useEffect, useState } from "react";
import { getAdminEscrowAudit, releaseAdminBatchPayouts, type AdminEscrowAuditResponse, type EscrowLedgerItem } from "../../api/admin";
import { AdminBottomNav, AdminMobileScreen, SearchInput, SectionCard, StatusChip, formatAgo, formatRwf } from "./AdminShell";

interface AdminEscrowAuditProps {
  onNavigate?: (target: string) => void;
}

const statusTone = (status: string): "green" | "amber" | "red" | "neutral" => {
  if (status === "released") return "green";
  if (status === "escrowed") return "amber";
  if (status === "discrepancy") return "red";
  return "neutral";
};

const LedgerCard = ({ item }: { item: EscrowLedgerItem }) => (
  <div className="rounded-[16px] border border-[rgba(163,177,155,0.14)] bg-[rgba(15,24,50,0.6)] p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="m-0 text-xs text-[var(--muted)]">#{item.transactionId}</p>
        <p className="m-0 mt-1 text-lg font-semibold">{item.title}</p>
      </div>
      <StatusChip tone={statusTone(item.status)}>{item.status}</StatusChip>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="m-0 text-xs text-[var(--muted)]">Total Amount</p>
        <p className={`m-0 mt-1 font-bold ${item.status === "discrepancy" ? "text-[#ff6767]" : "text-[var(--text)]"}`}>
          {formatRwf(item.totalAmount)}
        </p>
      </div>
      <div className="text-right">
        <p className="m-0 text-xs text-[var(--muted)]">Hub ID</p>
        <p className="m-0 mt-1 font-semibold text-[var(--text)]">{item.hubId}</p>
      </div>
    </div>
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">{item.farmerPayoutPercent}% Farmer Payout</span>
        <span className="font-semibold text-[#2eff63]">{formatRwf(item.farmerPayoutAmount)}</span>
      </div>
      <div className="h-2 rounded-full bg-[rgba(163,177,155,0.18)]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${item.farmerPayoutPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{item.auditReservePercent}% Operating/Audit</span>
        <span>{formatRwf(item.auditReserveAmount)}</span>
      </div>
      {item.discrepancyReason && <p className="m-0 mt-2 text-xs text-[#ff8f8f]">{item.discrepancyReason}</p>}
    </div>
  </div>
);

const AdminEscrowAudit = ({ onNavigate }: AdminEscrowAuditProps) => {
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

  return (
    <AdminMobileScreen>
      <div className="flex items-center justify-between">
        <div>
          <p className="m-0 text-2xl font-bold">{data?.header.title || "Escrow & Audit"}</p>
          <p className="m-0 text-xs tracking-[2px] text-[var(--muted)] uppercase">
            {data?.header.subtitle || "Live ledger"} • Last sync: {data?.lastSynced ? formatAgo(data.lastSynced) : "just now"}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full border border-[rgba(73,197,26,0.25)] bg-[rgba(73,197,26,0.08)]">
          <span className="text-sm text-[var(--accent)]">[]</span>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-3 text-sm text-[var(--accent)]">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <SectionCard className="bg-[linear-gradient(135deg,rgba(73,197,26,0.88),rgba(39,164,14,0.9))] text-[#071206]">
          <p className="m-0 text-xs font-medium opacity-80">Total in Escrow</p>
          <p className="m-0 mt-2 text-2xl font-bold">{summary ? formatRwf(summary.totalInEscrow) : "72.4M RWF"}</p>
          <p className="m-0 mt-2 text-xs font-semibold">+{summary?.totalInEscrowChangePct ?? 12.4}%</p>
        </SectionCard>
        <SectionCard className="bg-[rgba(31,45,74,0.9)]">
          <p className="m-0 text-xs text-[var(--muted)]">Pending Payouts</p>
          <p className="m-0 mt-2 text-2xl font-bold">{summary ? formatRwf(summary.pendingPayouts) : "14.8M RWF"}</p>
          <div className="mt-2"><StatusChip tone="green">{summary?.eligibleBatchPayoutCount ?? 0} batches</StatusChip></div>
        </SectionCard>
      </div>

      <div className="mt-4">
        <SearchInput value={query} onChange={setQuery} placeholder="Search transaction ID or hub..." />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {["all", ...(data?.filters.availableRegions || [])].map((region) => (
          <button
            key={region}
            type="button"
            onClick={() => setActiveRegion(region.toLowerCase())}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${activeRegion === region.toLowerCase() ? "bg-[rgba(73,197,26,0.16)] text-[var(--accent)] border border-[rgba(73,197,26,0.25)]" : "border border-[rgba(163,177,155,0.16)] text-[var(--muted)]"}`}
          >
            {region}
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {(data?.filters.availableStatuses || ["all", "escrowed", "released", "discrepancy"]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setActiveStatus(status)}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${activeStatus === status ? "bg-[rgba(31,45,74,0.95)] text-[var(--text)] border border-[rgba(121,139,176,0.25)]" : "border border-[rgba(163,177,155,0.16)] text-[var(--muted)]"}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="m-0 text-sm font-semibold tracking-[2px] uppercase text-[var(--muted)]">Transaction Ledger</p>
        <StatusChip tone="green">Secure Audit</StatusChip>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {loading && <p className="m-0 text-sm text-[var(--muted)] animate-pulse">Loading ledger...</p>}
        {!loading && (data?.ledger.length || 0) === 0 && <p className="m-0 text-sm text-[var(--muted)]">No ledger entries match the current filters.</p>}
        {(data?.ledger || []).slice(0, 4).map((item) => (
          <LedgerCard key={item.id} item={item} />
        ))}
      </div>

      <SectionCard className="mt-4">
        <div className="flex items-center justify-between">
          <p className="m-0 text-sm font-semibold">Payout Audit Trail</p>
          <StatusChip tone="green">Live</StatusChip>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {(data?.recentPayoutAudits || []).slice(0, 4).map((audit) => (
            <div key={audit.id} className="rounded-[12px] border border-[rgba(163,177,155,0.12)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-xs font-semibold uppercase tracking-[1.2px] text-[var(--muted)]">
                  {audit.provider} / {audit.method}
                </p>
                <StatusChip tone={audit.status === "succeeded" ? "green" : audit.status === "failed" ? "red" : "amber"}>
                  {audit.status}
                </StatusChip>
              </div>
              <p className="m-0 mt-1 text-sm">{formatRwf(audit.amount)} • {audit.executionMode}</p>
              <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                {audit.externalReference ? `Ref: ${audit.externalReference}` : "No external reference"} • {formatAgo(audit.processedAt)}
              </p>
              {audit.errorMessage && <p className="m-0 mt-1 text-xs text-[#ff8a8a]">{audit.errorMessage}</p>}
            </div>
          ))}
          {!loading && (data?.recentPayoutAudits.length || 0) === 0 && (
            <p className="m-0 text-sm text-[var(--muted)]">No payout audit records yet.</p>
          )}
        </div>
      </SectionCard>

      <button
        type="button"
        className="mt-4 w-full rounded-full bg-[var(--accent)] px-4 py-4 text-sm font-bold text-[#061007] shadow-[0_10px_28px_rgba(73,197,26,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={processingRelease}
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
        {processingRelease ? "Releasing Batch Payouts..." : "Release Batch Payouts"}
      </button>

      <AdminBottomNav active="escrow" onNavigate={onNavigate} />
    </AdminMobileScreen>
  );
};

export default AdminEscrowAudit;
