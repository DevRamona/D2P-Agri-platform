import { apiFetch } from "./client";

type AdminHeader = {
  title: string;
  subtitle: string;
  live: boolean;
};

export type AdminMetric = {
  id: string;
  label: string;
  value: number;
  display: string;
  unit: string;
  changePct: number;
};

export type AdminHubLocation = {
  hubName: string;
  hubId: string;
  region: string;
  district: string;
  activityLevel: "high" | "medium" | "low" | string;
  score: number;
  throughputKg: number;
  tradeVolumeRwf: number;
  plot: { x: number; y: number };
};

export type AdminEscalation = {
  id: string;
  title: string;
  subtitle: string;
  severity: "urgent" | "review" | "info" | string;
  issue: string;
  occurredAt: string;
};

export type AdminOverviewResponse = {
  screen: "nationwide_overview";
  header: AdminHeader;
  window: { active: string; options: string[] };
  metrics: AdminMetric[];
  hubActivity: { title: string; locations: AdminHubLocation[] };
  recentEscalations: AdminEscalation[];
  lastSynced: string;
};

export type EscrowLedgerItem = {
  id: string;
  transactionId: string;
  orderNumber: string | null;
  title: string;
  farmerName: string;
  buyerName: string;
  region: string;
  district: string;
  hubName: string;
  hubId: string;
  totalAmount: number;
  currency: string;
  farmerPayoutPercent: number;
  farmerPayoutAmount: number;
  auditReservePercent: number;
  auditReserveAmount: number;
  status: "escrowed" | "released" | "discrepancy" | "pending" | string;
  paymentStatus: string;
  escrowStatus: string;
  discrepancyReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEscrowAuditResponse = {
  screen: "escrow_audit";
  header: AdminHeader;
  summary: {
    totalInEscrow: number;
    totalInEscrowChangePct: number;
    pendingPayouts: number;
    pendingBatchCount: number;
    eligibleBatchPayoutCount: number;
    discrepancyCount: number;
  };
  filters: {
    q: string;
    region: string;
    hub: string;
    status: string;
    availableRegions: string[];
    availableHubs: string[];
    availableStatuses: string[];
  };
  ledger: EscrowLedgerItem[];
  recentPayoutAudits: Array<{
    id: string;
    orderId: string;
    provider: string;
    method: string;
    status: string;
    executionMode: "live" | "stub" | string;
    amount: number;
    currency: string;
    externalReference: string | null;
    errorMessage: string | null;
    processedAt: string;
  }>;
  lastSynced: string;
};

export type AdminDispute = {
  id: string;
  orderId: string;
  orderNumber: string;
  hubId: string;
  hubName: string;
  region: string;
  commodity: string;
  issue: string;
  severity: "high" | "medium" | "low" | string;
  severityLabel: string;
  reviewState: string;
  confidenceScore: number;
  aiDetectedGrade: string;
  issueDeltaPercent: number;
  operatorComments?: string;
  adminComments?: string;
  updatedAt: string;
};

export type AdminHubStat = {
  hubId: string;
  hubName: string;
  region: string;
  throughputKg: number;
  batchCount: number;
  activeDisputes: number;
  inspectionMinutes: number;
};

export type AdminHubDisputesResponse = {
  screen: "hub_disputes";
  header: AdminHeader;
  summary: {
    avgInspectionMinutes: number;
    avgInspectionChangePct: number;
    disputeRate: number;
    disputeRateChangePct: number;
    dailyThroughputKg: number;
    dailyThroughputChangePct: number;
  };
  weeklyTrend: Array<{ day: string; throughputKg: number; orderCount: number }>;
  tabs: { active: "hub_stats" | "quality_disputes" | string; options: Array<{ key: string; label: string }> };
  filters: { q: string; severity: string; availableSeverities: string[] };
  unresolvedCount: number;
  disputes: AdminDispute[];
  hubStats: AdminHubStat[];
  lastSynced: string;
};

const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
};

export const getAdminOverview = (window = "live") =>
  apiFetch<AdminOverviewResponse>(withQuery("/admin/overview", { window }));

export const getAdminEscrowAudit = (params?: {
  q?: string;
  region?: string;
  hub?: string;
  status?: string;
}) => apiFetch<AdminEscrowAuditResponse>(withQuery("/admin/escrow-audit", params || {}));

export const getAdminHubDisputes = (params?: {
  q?: string;
  tab?: string;
  severity?: string;
}) => apiFetch<AdminHubDisputesResponse>(withQuery("/admin/hubs-disputes", params || {}));

export const releaseAdminBatchPayouts = (limit = 10) =>
  apiFetch<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
    releasedTotalAmount: number;
    mode: string;
    message: string;
    processedAt: string;
    items: Array<{
      orderId: string;
      orderNumber: string;
      ok: boolean;
      skipped: boolean;
      error: string | null;
      provider: string | null;
      method: string;
      auditId: string | null;
      externalReference: string | null;
      executionMode: string | null;
      amount: number;
    }>;
  }>("/admin/escrow-audit/release-batch-payouts", {
    method: "POST",
    body: JSON.stringify({ limit }),
  });

export const reviewAdminDispute = (disputeId: string, payload: { action: string; comment?: string }) =>
  apiFetch<{ dispute: AdminDispute }>(`/admin/disputes/${disputeId}/review`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const createAdminDispute = (payload: {
  orderId?: string;
  batchId?: string;
  hubId?: string;
  hubName?: string;
  region?: string;
  commodity: string;
  issue: string;
  anomalyType?: string;
  severity?: "high" | "medium" | "low";
  confidenceScore?: number;
  aiDetectedGrade?: string;
  issueDeltaPercent?: number;
  operatorComments?: string;
  adminComments?: string;
}) =>
  apiFetch<{ dispute: AdminDispute }>("/admin/disputes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
