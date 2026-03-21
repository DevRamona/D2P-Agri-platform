const Batch = require("../models/Batch");
const BuyerOrder = require("../models/BuyerOrder");
const Dispute = require("../models/Dispute");
const PayoutAudit = require("../models/PayoutAudit");
const { releaseEscrowPayoutForOrder } = require("../services/adminPayoutService");
const { success, failure } = require("../utils/response");

const HUBS = [
  { key: "kigali", name: "Kigali Central", id: "HU-KIGALI-01", region: "Kigali City", district: "Kicukiro", x: 52, y: 58, aliases: ["kigali", "central"] },
  { key: "musanze", name: "Musanze Hub", id: "HU-NORTH-04", region: "Northern Province", district: "Musanze", x: 28, y: 20, aliases: ["musanze", "north"] },
  { key: "kayonza", name: "Kayonza Hub", id: "HU-EAST-18", region: "Eastern Province", district: "Kayonza", x: 82, y: 50, aliases: ["kayonza"] },
  { key: "nyagatare", name: "Nyagatare Hub", id: "HU-EAST-31", region: "Eastern Province", district: "Nyagatare", x: 70, y: 10, aliases: ["nyagatare"] },
  { key: "gashora", name: "Gashora Hub", id: "HU-EAST-22", region: "Eastern Province", district: "Bugesera", x: 61, y: 66, aliases: ["gashora", "bugesera", "east"] },
  { key: "ruhango", name: "Ruhango Hub", id: "HU-SOUTH-11", region: "Southern Province", district: "Ruhango", x: 45, y: 74, aliases: ["ruhango", "south"] },
  { key: "nyabihu", name: "Nyabihu Hub", id: "HU-NORTH-07", region: "Northern Province", district: "Nyabihu", x: 23, y: 31, aliases: ["nyabihu"] },
  { key: "gicumbi", name: "Gicumbi Hub", id: "HU-NORTH-12", region: "Northern Province", district: "Gicumbi", x: 56, y: 17, aliases: ["gicumbi"] },
];

const ISSUE_TEMPLATES = {
  maize: ["Moisture content mismatch (+4%)", "Kernel breakage above tolerance", "Bag weight variance (>50kg)"],
  coffee: ["Grade level (A1 vs B1) disagreement", "Foreign matter detected in sample", "Moisture variance above threshold"],
  potatoes: ["Size grading mismatch vs AI scan", "Damaged tuber rate above limit", "Weight reconciliation mismatch"],
  beans: ["Immature beans ratio exceeds threshold", "Color mismatch vs AI-detected class", "Foreign matter contamination flagged"],
  mixed: ["Manifest and physical count mismatch", "Inspection SLA exceeded", "Quality dispute pending review"],
};

const WINDOW_MS = {
  live: 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const n = (v) => Number(v) || 0;
const d = (v) => {
  const dt = v ? new Date(v) : null;
  return dt && !Number.isNaN(dt.getTime()) ? dt : null;
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, digits = 1) => {
  const f = 10 ** digits;
  return Math.round((Number(v) || 0) * f) / f;
};
const compact = (v) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(n(v)));
const pctChange = (current, prev) => (n(prev) > 0 ? ((n(current) - n(prev)) / n(prev)) * 100 : n(current) > 0 ? 100 : 0);
const within = (value, start, end) => {
  const dt = d(value);
  return !!dt && dt >= start && dt <= end;
};

const hash = (value) => {
  let h = 0;
  const s = String(value || "");
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const cropKey = (order) => {
  const raw = String(order?.cropKey || order?.cropNames?.[0] || "").toLowerCase();
  if (!raw) return "mixed";
  if (raw.includes("bean")) return "beans";
  if (raw.includes("maize") || raw.includes("corn")) return "maize";
  if (raw.includes("coffee")) return "coffee";
  if (raw.includes("potato")) return "potatoes";
  return raw;
};

const hubMeta = (destination, title = "") => {
  const hay = `${String(destination || "")} ${String(title || "")}`.toLowerCase();
  return HUBS.find((hub) => hub.aliases.some((a) => hay.includes(a))) || HUBS[0];
};

const isObjectIdString = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));

const DISPUTE_STATUS_LABEL = {
  pending_review: "Standard Review",
  under_review: "Under Review",
  pending_escalation: "Pending Escalation",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

const toReviewState = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending_escalation") return "pending escalation";
  if (normalized === "under_review") return "under review";
  if (normalized === "resolved") return "resolved";
  if (normalized === "dismissed") return "dismissed";
  return "standard review";
};

const toDisputeDto = (doc) => ({
  id: String(doc._id),
  orderId: doc.order ? String(doc.order) : "",
  orderNumber: doc.orderNumber || (doc.order ? `#${String(doc.order).slice(-4)}` : "#N/A"),
  hubId: doc.hubId,
  hubName: doc.hubName,
  region: doc.region,
  commodity: doc.commodity,
  issue: doc.issue,
  anomalyType: doc.anomalyType,
  severity: doc.severity,
  severityLabel: DISPUTE_STATUS_LABEL[doc.status] || DISPUTE_STATUS_LABEL.pending_review,
  reviewState: toReviewState(doc.status),
  confidenceScore: doc.confidenceScore == null ? 0 : round(doc.confidenceScore, 1),
  aiDetectedGrade: doc.aiDetectedGrade || "-",
  issueDeltaPercent: doc.issueDeltaPercent == null ? 0 : Number(doc.issueDeltaPercent),
  operatorComments: doc.operatorComments || "",
  adminComments: doc.adminComments || "",
  updatedAt: (d(doc.lastActionAt) || d(doc.updatedAt) || d(doc.createdAt) || new Date()).toISOString(),
});

const seedPersistentDisputesIfEmpty = async (orders) => {
  const count = await Dispute.countDocuments();
  if (count > 0) return;

  const derived = deriveDisputes(orders || []);
  if (!derived.length) return;

  const now = new Date();
  const ops = derived.map((row) => ({
    updateOne: {
      filter: isObjectIdString(row.orderId)
        ? { order: row.orderId, anomalyType: row.anomalyType || "quality_variance", issue: row.issue }
        : { hubId: row.hubId, commodity: row.commodity, issue: row.issue, source: "system_derived" },
      update: {
        $setOnInsert: {
          order: isObjectIdString(row.orderId) ? row.orderId : null,
          hubId: row.hubId,
          hubName: row.hubName,
          region: row.region,
          commodity: row.commodity,
          issue: row.issue,
          anomalyType: row.anomalyType || "quality_variance",
          severity: row.severity === "high" || row.severity === "medium" ? row.severity : "low",
          status:
            row.severity === "high"
              ? "pending_escalation"
              : row.reviewState === "under review"
                ? "under_review"
                : "pending_review",
          confidenceScore: row.confidenceScore || null,
          aiDetectedGrade: row.aiDetectedGrade || null,
          issueDeltaPercent: row.issueDeltaPercent || null,
          source:
            row.severity === "high" && String(row.issue || "").toLowerCase().includes("payment")
              ? "payment_failure"
              : "system_derived",
          lastActionAt: now,
          events: [
            {
              action: "created",
              actorRole: "SYSTEM",
              message: "Initial dispute seeded from existing order/hub data",
              nextStatus:
                row.severity === "high"
                  ? "pending_escalation"
                  : row.reviewState === "under review"
                    ? "under_review"
                    : "pending_review",
              createdAt: now,
            },
          ],
        },
      },
      upsert: true,
    },
  }));

  if (ops.length) {
    try {
      await Dispute.bulkWrite(ops, { ordered: false });
    } catch (error) {
      if (error?.code !== 11000) {
        console.warn("Dispute seed bulkWrite warning:", error.message || error);
      }
    }
  }
};

const loadPersistentDisputes = async (orders) => {
  await seedPersistentDisputesIfEmpty(orders);
  return Dispute.find({}).sort({ lastActionAt: -1, updatedAt: -1, createdAt: -1 }).lean();
};

const upsertPayoutFailureDispute = async ({ order, errorMessage }) => {
  const hub = hubMeta(order.destination, order.title);
  const now = new Date();
  const issue = errorMessage || "Escrow release failed during payout processing";
  const existing = await Dispute.findOne({
    order: order._id,
    anomalyType: "payout_failure",
    status: { $nin: ["resolved", "dismissed"] },
  });

  if (existing) {
    existing.severity = "high";
    existing.status = "pending_escalation";
    existing.issue = issue;
    existing.lastActionAt = now;
    existing.events.push({
      action: "escalate",
      actorRole: "SYSTEM",
      message: "Payout release failed again and was escalated for admin review",
      previousStatus: existing.status,
      nextStatus: "pending_escalation",
      createdAt: now,
    });
    await existing.save();
    return existing;
  }

  return Dispute.create({
    order: order._id,
    batch: order.batch || null,
    hubId: hub.id,
    hubName: hub.name,
    region: hub.region,
    commodity: order.cropNames?.[0] || order.cropKey || "Produce",
    issue,
    anomalyType: "payout_failure",
    severity: "high",
    status: "pending_escalation",
    confidenceScore: null,
    aiDetectedGrade: null,
    issueDeltaPercent: null,
    source: "payout_failure",
    operatorComments: "",
    adminComments: "",
    lastActionAt: now,
    events: [
      {
        action: "created",
        actorRole: "SYSTEM",
        message: "Dispute auto-created from payout execution failure",
        nextStatus: "pending_escalation",
        createdAt: now,
      },
    ],
  });
};

const deriveDisputes = (orders) => {
  const rows = [];
  const now = Date.now();
  for (const order of orders) {
    if (String(order.status || "").toLowerCase() === "cancelled") continue;
    const created = d(order.createdAt) || new Date();
    const ageHours = (now - created.getTime()) / 3600000;
    const payment = String(order.paymentStatus || "").toLowerCase();
    const escrow = String(order.escrowStatus || "").toLowerCase();
    const stage = String(order.trackingStage || "").toLowerCase();
    let severity = "";
    let source = "";
    let anomalyType = "";
    if (escrow === "release_failed" || payment === "failed") {
      severity = "high";
      source = "payment_reconciliation";
      anomalyType = "payment_reconciliation";
    } else if (stage === "hub_inspection" && ageHours > 24) {
      severity = ageHours > 48 ? "high" : "medium";
      source = "inspection_sla";
      anomalyType = "inspection_sla";
    } else if (stage === "hub_inspection" && hash(order._id) % 5 === 0) {
      severity = "low";
      source = "quality_variance";
      anomalyType = "quality_variance";
    }
    if (!severity) continue;
    const hub = hubMeta(order.destination, order.title);
    const key = cropKey(order);
    const issues = ISSUE_TEMPLATES[key] || ISSUE_TEMPLATES.mixed;
    rows.push({
      id: String(order._id),
      orderId: String(order._id),
      orderNumber: order.orderNumber || `#${String(order._id).slice(-4)}`,
      hubId: hub.id,
      hubName: hub.name,
      region: hub.region,
      commodity: order.cropNames?.[0] || order.cropKey || "Produce",
      issue: issues[hash(String(order._id) + source) % issues.length],
      anomalyType,
      severity,
      severityLabel: severity === "high" ? "High Severity" : severity === "medium" ? "Pending Escalation" : "Standard Review",
      reviewState: severity === "high" ? "pending escalation" : severity === "medium" ? "standard review" : "standard review",
      confidenceScore: round(87 + (hash(order._id) % 90) / 10, 1),
      aiDetectedGrade: ["A", "B", "C"][hash(String(order._id) + "g") % 3],
      issueDeltaPercent: (hash(String(order._id) + "d") % 6) + 1,
      updatedAt: (d(order.updatedAt) || created).toISOString(),
    });
  }
  return rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

const inspectionAgeMinutes = (order, now) => {
  if (String(order?.trackingStage || "").toLowerCase() !== "hub_inspection") return 0;
  const start =
    d(order?.paymentConfirmedAt)
    || d(order?.escrowFundedAt)
    || d(order?.createdAt);
  if (!start) return 0;
  return clamp(Math.round((now.getTime() - start.getTime()) / 60000), 0, 24 * 60);
};

const paymentMethodLabel = (method) => {
  const normalized = String(method || "").trim().toLowerCase();
  if (normalized === "card") return "Card";
  if (normalized === "momo") return "MTN Mobile Money";
  if (normalized === "airtel") return "Airtel Money";
  if (normalized === "bank") return "Bank Transfer";
  return "Card";
};

const toAdminOrderSummary = (order) => ({
  id: String(order._id),
  orderNumber: order.orderNumber || null,
  title: order.title || "Produce Batch",
  cropKey: order.cropKey || "mixed",
  cropNames: Array.isArray(order.cropNames) ? order.cropNames : [],
  farmerName: order.farmerName || "Farmer",
  buyerName: order.buyerName || "Buyer",
  destination: order.destination || "Kigali Central Aggregator",
  status: order.status || "active",
  paymentStatus: order.paymentStatus || "pending",
  trackingStage: order.trackingStage || "awaiting_payment",
  image: order.image || null,
  totalWeight: n(order.totalWeight),
  totalPrice: n(order.totalPrice),
  pricePerKg: n(order.pricePerKg),
  currency: String(order.currency || "RWF").toUpperCase(),
  depositPercent: typeof order.depositPercent === "number" ? order.depositPercent : 0.6,
  depositAmount: n(order.depositAmount),
  balanceDue: n(order.balanceDue),
  serviceFee: n(order.serviceFee),
  insuranceFee: n(order.insuranceFee),
  amountDueToday: n(order.amountDueToday),
  paymentMethod: order.paymentMethod || "card",
  escrowStatus: order.escrowStatus || "awaiting_payment",
  estimatedArrivalAt: d(order.estimatedArrivalAt)?.toISOString() || null,
  trackingUpdatedAt: d(order.trackingUpdatedAt)?.toISOString() || null,
  paymentConfirmedAt: d(order.paymentConfirmedAt)?.toISOString() || null,
  escrowFundedAt: d(order.escrowFundedAt)?.toISOString() || null,
  escrowReleasedAt: d(order.escrowReleasedAt)?.toISOString() || null,
  deliveryConfirmedAt: d(order.deliveryConfirmedAt)?.toISOString() || null,
  createdAt: d(order.createdAt)?.toISOString() || null,
  updatedAt: d(order.updatedAt)?.toISOString() || null,
});

const toAdminOrderTimeline = (order) => {
  const createdAt = d(order.createdAt) || new Date();
  const trackingUpdatedAt = d(order.trackingUpdatedAt) || new Date();
  const isPaymentConfirmed = String(order.paymentStatus || "").toLowerCase() === "deposit_paid";
  const stages = [
    {
      key: "payment_confirmed",
      title: "Payment Confirmed",
      detail: isPaymentConfirmed
        ? `Deposit secured in escrow via ${String(order.paymentMethod || "card").toUpperCase()}`
        : `Awaiting buyer deposit payment via ${paymentMethodLabel(order.paymentMethod)}`,
      time: isPaymentConfirmed ? createdAt.toLocaleString() : "Pending payment",
    },
    {
      key: "farmer_dispatching",
      title: "Farmer Delivering to Hub",
      detail: `Farmer: ${order.farmerName || "Farmer"}`,
      time: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000).toLocaleString(),
    },
    {
      key: "hub_inspection",
      title: "Hub Inspection Underway",
      detail: "Quality and weight verification at the aggregation hub",
      time: "In Progress - Processing",
    },
    {
      key: "released_for_delivery",
      title: "Released for Delivery",
      detail: "",
      time: "Pending quality certificate issuance",
    },
    {
      key: "delivered",
      title: "Delivered",
      detail: "Delivery confirmed by buyer",
      time: d(order.completedAt) ? d(order.completedAt).toLocaleString() : "Pending buyer confirmation",
    },
  ];
  const stageOrder = stages.map((item) => item.key);
  const currentIndex = isPaymentConfirmed ? Math.max(0, stageOrder.indexOf(order.trackingStage || "payment_confirmed")) : -1;

  return stages.map((stage, index) => ({
    ...stage,
    status: !isPaymentConfirmed
      ? "pending"
      : index < currentIndex
        ? "done"
        : index === currentIndex
          ? (String(order.status || "").toLowerCase() === "cancelled" ? "pending" : "active")
          : "pending",
    updatedAt: trackingUpdatedAt.toISOString(),
  }));
};

const getAdminOverview = async (req, res) => {
  try {
    const key = String(req.query.window || "live").toLowerCase();
    const windowMs = WINDOW_MS[key] || WINDOW_MS.live;
    const now = new Date();
    const currentStart = new Date(now.getTime() - windowMs);
    const prevStart = new Date(currentStart.getTime() - windowMs);

    const [orders, batches] = await Promise.all([
      BuyerOrder.find({}).sort({ createdAt: -1 }).lean(),
      Batch.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const activeOrders = orders.filter((o) => String(o.status || "").toLowerCase() !== "cancelled");
    const currentOrders = activeOrders.filter((o) => within(o.createdAt, currentStart, now));
    const prevOrders = activeOrders.filter((o) => within(o.createdAt, prevStart, currentStart));
    const currentBatches = batches.filter((b) => within(b.createdAt, currentStart, now));
    const prevBatches = batches.filter((b) => within(b.createdAt, prevStart, currentStart));

    const tradeCurrent = currentOrders.reduce((s, o) => s + n(o.totalPrice), 0);
    const tradePrev = prevOrders.reduce((s, o) => s + n(o.totalPrice), 0);
    const escrowCurrentRaw = currentOrders
      .filter((o) => String(o.escrowStatus || "").toLowerCase() === "funded")
      .reduce((s, o) => s + (n(o.depositAmount) || n(o.amountDueToday)), 0);
    const escrowPrevRaw = prevOrders
      .filter((o) => String(o.escrowStatus || "").toLowerCase() === "funded")
      .reduce((s, o) => s + (n(o.depositAmount) || n(o.amountDueToday)), 0);

    const disputeDocs = await loadPersistentDisputes(activeOrders);
    const disputes = disputeDocs
      .filter((item) => !["resolved", "dismissed"].includes(String(item.status || "").toLowerCase()))
      .map(toDisputeDto);
    const currentDisputes = disputes.filter((item) => within(item.updatedAt, currentStart, now));
    const prevDisputes = disputes.filter((item) => within(item.updatedAt, prevStart, currentStart));
    const currentDisputeRate = currentOrders.length ? (currentDisputes.length / currentOrders.length) * 100 : 0;
    const prevDisputeRate = prevOrders.length ? (prevDisputes.length / prevOrders.length) * 100 : 0;
    const aiAccuracy = currentOrders.length ? clamp(95 - currentDisputeRate * 0.4, 89, 98.8) : 0;
    const prevAiAccuracy = prevOrders.length ? clamp(95 - prevDisputeRate * 0.4, 89, 98.8) : 0;

    const userSetCurrent = new Set();
    const userSetPrev = new Set();
    currentOrders.forEach((o) => {
      if (o.buyer) userSetCurrent.add(String(o.buyer));
      if (o.farmer) userSetCurrent.add(String(o.farmer));
    });
    prevOrders.forEach((o) => {
      if (o.buyer) userSetPrev.add(String(o.buyer));
      if (o.farmer) userSetPrev.add(String(o.farmer));
    });
    currentBatches.forEach((b) => b.farmer && userSetCurrent.add(String(b.farmer)));
    prevBatches.forEach((b) => b.farmer && userSetPrev.add(String(b.farmer)));
    const activeUsers = userSetCurrent.size;
    const prevActiveUsers = userSetPrev.size;

    const hubMap = new Map();
    const touchHub = (meta) => {
      if (!hubMap.has(meta.key)) hubMap.set(meta.key, { ...meta, throughputKg: 0, tradeVolumeRwf: 0, activeOrders: 0, disputes: 0 });
      return hubMap.get(meta.key);
    };
    currentBatches.forEach((b) => {
      const h = touchHub(hubMeta(b.destination, ""));
      h.throughputKg += n(b.totalWeight);
      h.tradeVolumeRwf += n(b.totalPrice);
    });
    currentOrders.forEach((o) => {
      const h = touchHub(hubMeta(o.destination, o.title));
      h.throughputKg += n(o.totalWeight);
      h.tradeVolumeRwf += n(o.totalPrice);
      if (String(o.status || "").toLowerCase() === "active") h.activeOrders += 1;
    });
    currentDisputes.forEach((item) => {
      const h = touchHub(hubMeta(item.hubName, item.commodity));
      h.disputes += 1;
    });
    const hubs = Array.from(hubMap.values()).sort((a, b) => b.throughputKg - a.throughputKg);
    const maxThroughput = Math.max(1, ...hubs.map((h) => h.throughputKg || 0));
    const hubLocations = hubs.slice(0, 8).map((h) => {
      const ratio = (h.throughputKg || 0) / maxThroughput;
      const activityLevel = ratio >= 0.67 ? "high" : ratio >= 0.34 ? "medium" : "low";
      return {
        hubName: h.name,
        hubId: h.id,
        region: h.region,
        district: h.district,
        activityLevel,
        score: round(ratio * 100, 1),
        throughputKg: Math.round(h.throughputKg),
        tradeVolumeRwf: Math.round(h.tradeVolumeRwf),
        plot: { x: h.x, y: h.y },
      };
    });

    const recentEscalations = currentDisputes.slice(0, 5).map((x) => ({
      id: x.id,
      title: x.severity === "high" ? `Escrow dispute ${x.orderNumber}` : `Quality dispute ${x.orderNumber}`,
      subtitle: `${x.hubName} | ${x.commodity}`,
      severity: x.severity === "high" ? "urgent" : x.severity === "medium" ? "review" : "info",
      issue: x.issue,
      occurredAt: x.updatedAt,
    }));

    const hasData = currentOrders.length > 0 || currentBatches.length > 0 || currentDisputes.length > 0;

    return res.status(200).json(success({
      screen: "nationwide_overview",
      hasData,
      header: { title: "Nationwide Overview", subtitle: "Rwanda D2P Command Center", live: true },
      window: { active: key in WINDOW_MS ? key : "live", options: Object.keys(WINDOW_MS) },
      metrics: [
        { id: "trade_volume", label: "Trade Volume", value: Math.round(tradeCurrent), display: compact(tradeCurrent), unit: "RWF", changePct: round(pctChange(tradeCurrent, tradePrev), 1) },
        { id: "escrow_locked", label: "Escrow Locked", value: Math.round(escrowCurrentRaw), display: compact(escrowCurrentRaw), unit: "RWF", changePct: round(pctChange(escrowCurrentRaw, escrowPrevRaw), 1) },
        { id: "ai_accuracy", label: "AI Accuracy", value: round(aiAccuracy, 1), display: `${round(aiAccuracy, 1)}%`, unit: "%", changePct: round(pctChange(aiAccuracy, prevAiAccuracy), 1) },
        { id: "active_users", label: "Active Users", value: activeUsers, display: compact(activeUsers), unit: "", changePct: round(pctChange(activeUsers, prevActiveUsers), 1) },
      ],
      hubActivity: { title: "Hub Activity Levels", locations: hubLocations },
      recentEscalations,
      lastSynced: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to load admin overview"));
  }
};

const ledgerStatus = (order) => {
  const payment = String(order.paymentStatus || "").toLowerCase();
  const escrow = String(order.escrowStatus || "").toLowerCase();
  if (payment === "failed" || escrow === "release_failed") return "discrepancy";
  if (escrow === "released") return "released";
  if (escrow === "funded" || payment === "deposit_paid") return "escrowed";
  return "pending";
};

const getAdminEscrowAudit = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const region = String(req.query.region || "all").trim().toLowerCase();
    const hub = String(req.query.hub || "all").trim().toLowerCase();
    const status = String(req.query.status || "all").trim().toLowerCase();

    const [orders, payoutAudits] = await Promise.all([
      BuyerOrder.find({}).sort({ createdAt: -1 }).lean(),
      PayoutAudit.find({}).sort({ processedAt: -1, createdAt: -1 }).limit(12).lean(),
    ]);
    const ledger = orders.map((o) => {
      const h = hubMeta(o.destination, o.title);
      const totalAmount = Math.round(n(o.totalPrice));
      const farmerPayoutAmount = Math.round(totalAmount * 0.6);
      const auditReserveAmount = Math.max(0, totalAmount - farmerPayoutAmount);
      const s = ledgerStatus(o);
      return {
        id: String(o._id),
        orderId: String(o._id),
        transactionId: o.orderNumber || `TXN-${String(o._id).slice(-6).toUpperCase()}`,
        orderNumber: o.orderNumber || null,
        title: o.title || "Produce Batch",
        farmerName: o.farmerName || "Farmer",
        buyerName: o.buyerName || "Buyer",
        region: h.region,
        district: h.district,
        hubName: h.name,
        hubId: h.id,
        totalAmount,
        currency: String(o.currency || "RWF").toUpperCase(),
        farmerPayoutPercent: 60,
        farmerPayoutAmount,
        auditReservePercent: 40,
        auditReserveAmount,
        status: s,
        paymentStatus: String(o.paymentStatus || "pending").toLowerCase(),
        escrowStatus: String(o.escrowStatus || "awaiting_payment").toLowerCase(),
        trackingStage: String(o.trackingStage || "awaiting_payment").toLowerCase(),
        discrepancyReason: s === "discrepancy" ? (String(o.escrowStatus || "").toLowerCase() === "release_failed" ? "Escrow release failed during payout processing" : "Deposit payment failed reconciliation") : null,
        createdAt: (d(o.createdAt) || new Date()).toISOString(),
        updatedAt: (d(o.updatedAt) || d(o.createdAt) || new Date()).toISOString(),
      };
    });

    const filtered = ledger.filter((item) => {
      if (region !== "all" && item.region.toLowerCase() !== region) return false;
      if (hub !== "all" && item.hubName.toLowerCase() !== hub) return false;
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.transactionId, item.orderNumber, item.title, item.hubName, item.hubId, item.farmerName, item.buyerName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const totalInEscrow = filtered.filter((i) => i.status === "escrowed").reduce((s, i) => s + i.totalAmount, 0);
    const pendingPayouts = filtered.filter((i) => i.status === "escrowed").reduce((s, i) => s + i.farmerPayoutAmount, 0);
    const pendingBatchCount = filtered.filter((i) => i.status === "escrowed").length;
    const discrepancyCount = filtered.filter((i) => i.status === "discrepancy").length;
    const eligibleBatchPayoutCount = filtered.filter((i) => i.status === "escrowed" && i.escrowStatus === "funded").length;

    const recentPayoutAudits = payoutAudits.map((audit) => ({
      id: String(audit._id),
      orderId: String(audit.order || ""),
      provider: audit.provider,
      method: audit.method,
      status: audit.status,
      executionMode: audit.executionMode,
      amount: Math.round(n(audit.amount)),
      currency: String(audit.currency || "RWF").toUpperCase(),
      externalReference: audit.externalReference || null,
      errorMessage: audit.errorMessage || null,
      processedAt: (d(audit.processedAt) || d(audit.createdAt) || new Date()).toISOString(),
    }));
    const hasData = ledger.length > 0 || recentPayoutAudits.length > 0;

    return res.status(200).json(success({
      screen: "escrow_audit",
      hasData,
      header: { title: "Escrow & Audit", subtitle: "Live ledger", live: true },
      summary: {
        totalInEscrow,
        totalInEscrowChangePct: 0,
        pendingPayouts,
        pendingBatchCount,
        eligibleBatchPayoutCount,
        discrepancyCount,
      },
      filters: {
        q,
        region,
        hub,
        status,
        availableRegions: Array.from(new Set(ledger.map((i) => i.region))).sort(),
        availableHubs: Array.from(new Set(ledger.map((i) => i.hubName))).sort(),
        availableStatuses: ["all", "escrowed", "released", "discrepancy", "pending"],
      },
      ledger: filtered.slice(0, 50),
      recentPayoutAudits,
      lastSynced: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Admin escrow audit error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to load escrow audit"));
  }
};

const getAdminHubDisputes = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const tab = String(req.query.tab || "quality_disputes").trim().toLowerCase();
    const severity = String(req.query.severity || "all").trim().toLowerCase();
    const [orders, batches] = await Promise.all([
      BuyerOrder.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      Batch.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    const activeOrders = orders.filter((o) => String(o.status || "").toLowerCase() !== "cancelled");
    const disputeDocs = await loadPersistentDisputes(activeOrders);
    const unresolvedDisputes = disputeDocs
      .map(toDisputeDto)
      .filter((x) => !["resolved", "dismissed"].includes(x.reviewState));
    const disputes = unresolvedDisputes.filter((x) => {
      if (severity !== "all" && x.severity !== severity) return false;
      if (!q) return true;
      return [x.hubName, x.hubId, x.commodity, x.issue, x.orderNumber].join(" ").toLowerCase().includes(q);
    });

    const hubStatsMap = new Map();
    const touch = (h) => {
      if (!hubStatsMap.has(h.id)) {
        hubStatsMap.set(h.id, {
          hubId: h.id,
          hubName: h.name,
          region: h.region,
          throughputKg: 0,
          batchCount: 0,
          activeDisputes: 0,
          inspectionTotalMinutes: 0,
          inspectionSamples: 0,
        });
      }
      return hubStatsMap.get(h.id);
    };
    batches.forEach((b) => {
      const row = touch(hubMeta(b.destination, ""));
      row.throughputKg += n(b.totalWeight);
      row.batchCount += 1;
    });
    const now = new Date();
    activeOrders.forEach((order) => {
      const row = touch(hubMeta(order.destination, order.title));
      const minutes = inspectionAgeMinutes(order, now);
      if (minutes > 0) {
        row.inspectionTotalMinutes += minutes;
        row.inspectionSamples += 1;
      }
    });
    unresolvedDisputes.forEach((x) => {
      const row = touch(hubMeta(x.hubName, x.commodity));
      row.activeDisputes += 1;
    });

    const hubStats = Array.from(hubStatsMap.values())
      .map((r) => ({
        ...r,
        throughputKg: Math.round(r.throughputKg),
        inspectionMinutes: r.inspectionSamples ? Math.round(r.inspectionTotalMinutes / r.inspectionSamples) : 0,
      }))
      .sort((a, b) => b.throughputKg - a.throughputKg)
      .slice(0, 12);
    const filteredHubStats = hubStats.filter((hub) => {
      if (!q) return true;
      return [hub.hubName, hub.hubId, hub.region].join(" ").toLowerCase().includes(q);
    });

    const avgInspectionMinutes = hubStats.length
      ? Math.round(hubStats.reduce((s, r) => s + r.inspectionMinutes, 0) / hubStats.length)
      : 0;
    const disputeRate = activeOrders.length ? (unresolvedDisputes.length / activeOrders.length) * 100 : 0;

    const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startYesterday = new Date(startToday.getTime() - 86400000);
    const todayThroughput = activeOrders.filter((o) => within(o.createdAt, startToday, now)).reduce((s, o) => s + n(o.totalWeight), 0);
    const yesterdayThroughput = activeOrders.filter((o) => within(o.createdAt, startYesterday, startToday)).reduce((s, o) => s + n(o.totalWeight), 0);

    const weekday = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const weeklyTrend = weekday.map((day) => ({ day, throughputKg: 0, orderCount: 0 }));
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    activeOrders.forEach((o) => {
      const created = d(o.createdAt);
      if (!created || created < weekAgo) return;
      const idx = (created.getUTCDay() + 6) % 7;
      weeklyTrend[idx].throughputKg += n(o.totalWeight);
      weeklyTrend[idx].orderCount += 1;
    });
    const hasTrendData = weeklyTrend.some((point) => point.throughputKg > 0);
    const hasData = filteredHubStats.length > 0 || unresolvedDisputes.length > 0 || hasTrendData;

    return res.status(200).json(success({
      screen: "hub_disputes",
      hasData,
      summary: {
        avgInspectionMinutes,
        avgInspectionChangePct: 0,
        disputeRate: round(disputeRate, 1),
        disputeRateChangePct: 0,
        dailyThroughputKg: Math.round(todayThroughput),
        dailyThroughputChangePct: round(pctChange(todayThroughput, yesterdayThroughput), 1),
      },
      weeklyTrend: weeklyTrend.map((p) => ({ ...p, throughputKg: round(p.throughputKg, 1) })),
      tabs: { active: tab === "hub_stats" ? "hub_stats" : "quality_disputes", options: [{ key: "hub_stats", label: "Hub Stats" }, { key: "quality_disputes", label: "Quality Disputes" }] },
      filters: { q, severity, availableSeverities: ["all", "high", "medium", "low"] },
      unresolvedCount: disputes.length,
      disputes: disputes.slice(0, 50),
      hubStats: filteredHubStats,
      header: { title: "Hub & Disputes", subtitle: "Admin Dashboard | Rwanda Nationwide", live: true },
      lastSynced: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Admin hub disputes error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to load hub disputes"));
  }
};

const advanceAdminOrderTracking = async (req, res) => {
  try {
    const order = await BuyerOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    if (String(order.paymentStatus || "").toLowerCase() !== "deposit_paid" || String(order.escrowStatus || "").toLowerCase() !== "funded") {
      return res.status(400).json(failure("ESCROW_NOT_READY", "Order payment must be funded before admin delivery actions"));
    }

    const currentStage = String(order.trackingStage || "").toLowerCase();
    if (currentStage === "farmer_dispatching") {
      order.trackingStage = "hub_inspection";
    } else if (currentStage === "hub_inspection") {
      order.trackingStage = "released_for_delivery";
    } else if (currentStage !== "released_for_delivery" && currentStage !== "delivered") {
      return res.status(400).json(failure("INVALID_TRACKING_STAGE", "This order is not ready for an admin stage update"));
    }

    order.trackingUpdatedAt = new Date();
    await order.save();

    return res.status(200).json(success({
      order: {
        id: String(order._id),
        orderNumber: order.orderNumber || null,
        trackingStage: order.trackingStage || "awaiting_payment",
        escrowStatus: order.escrowStatus || "awaiting_payment",
        updatedAt: (d(order.trackingUpdatedAt) || new Date()).toISOString(),
      },
    }));
  } catch (error) {
    console.error("Admin advance order tracking error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to update order tracking"));
  }
};

const getAdminOrderById = async (req, res) => {
  try {
    const order = await BuyerOrder.findById(req.params.id).lean();
    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    return res.status(200).json(success({
      order: toAdminOrderSummary(order),
      timeline: toAdminOrderTimeline(order),
      hub: hubMeta(order.destination, order.title),
    }));
  } catch (error) {
    console.error("Admin order detail error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to load order detail"));
  }
};

const releaseAdminBatchPayouts = async (req, res) => {
  try {
    const limitRaw = Number(req.body?.limit);
    const limit = clamp(Number.isFinite(limitRaw) ? limitRaw : 10, 1, 100);
    const eligible = await BuyerOrder.find({
      paymentStatus: "deposit_paid",
      escrowStatus: "funded",
    })
      .sort({ createdAt: 1 })
      .limit(limit);

    if (eligible.length === 0) {
      return res.status(200).json(success({
        releasedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        releasedTotalAmount: 0,
        mode: "provider_execution",
        message: "No funded escrow batches available for release.",
        processedAt: new Date().toISOString(),
        items: [],
      }));
    }

    const actorUserId = req.user?.id || null;
    const results = [];
    for (const orderDoc of eligible) {
      const order = orderDoc.toObject();
      const outcome = await releaseEscrowPayoutForOrder({ order, actorUserId });
      results.push({
        orderId: String(order._id),
        orderNumber: order.orderNumber || `#${String(order._id).slice(-4)}`,
        ok: outcome.ok,
        skipped: Boolean(outcome.skipped),
        error: outcome.error || null,
        provider: outcome.provider || null,
        method: outcome.method || String(order.paymentMethod || ""),
        auditId: outcome.audit ? String(outcome.audit._id) : null,
        externalReference: outcome.externalReference || outcome.audit?.externalReference || null,
        executionMode: outcome.executionMode || outcome.audit?.executionMode || null,
        amount: Math.round(n(order.depositAmount) || n(order.amountDueToday) || 0),
      });

      if (!outcome.ok && !outcome.skipped) {
        await upsertPayoutFailureDispute({
          order,
          errorMessage: outcome.error || "Escrow release failed during payout processing",
        });
      }
    }

    const releasedCount = results.filter((x) => x.ok).length;
    const failedCount = results.filter((x) => !x.ok && !x.skipped).length;
    const skippedCount = results.filter((x) => x.skipped).length;
    const releasedTotalAmount = results.filter((x) => x.ok).reduce((sum, x) => sum + n(x.amount), 0);

    return res.status(200).json(success({
      releasedCount,
      failedCount,
      skippedCount,
      releasedTotalAmount: Math.round(releasedTotalAmount),
      mode: "provider_execution",
      message: `Processed ${results.length} payout(s): ${releasedCount} released, ${failedCount} failed, ${skippedCount} skipped.`,
      processedAt: new Date().toISOString(),
      items: results,
    }));
  } catch (error) {
    console.error("Admin release batch payouts error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to release batch payouts"));
  }
};

const createAdminDispute = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const hub = hubMeta(body.hubName || body.destination || "", body.title || "");
    const severity = ["high", "medium", "low"].includes(String(body.severity || "").toLowerCase())
      ? String(body.severity).toLowerCase()
      : "medium";
    const status = severity === "high" ? "pending_escalation" : "pending_review";
    const now = new Date();

    if (!String(body.issue || "").trim()) {
      return res.status(400).json(failure("BAD_REQUEST", "issue is required"));
    }

    const dispute = await Dispute.create({
      order: isObjectIdString(body.orderId) ? body.orderId : null,
      batch: isObjectIdString(body.batchId) ? body.batchId : null,
      hubId: String(body.hubId || hub.id),
      hubName: String(body.hubName || hub.name),
      region: String(body.region || hub.region),
      commodity: String(body.commodity || "Produce"),
      issue: String(body.issue).trim(),
      anomalyType: String(body.anomalyType || "manual_review").trim().toLowerCase(),
      severity,
      status,
      confidenceScore: body.confidenceScore == null ? null : Number(body.confidenceScore),
      aiDetectedGrade: body.aiDetectedGrade ? String(body.aiDetectedGrade) : null,
      issueDeltaPercent: body.issueDeltaPercent == null ? null : Number(body.issueDeltaPercent),
      source: "admin_manual",
      operatorComments: body.operatorComments ? String(body.operatorComments) : "",
      adminComments: body.adminComments ? String(body.adminComments) : "",
      createdBy: req.user?.id || null,
      assignedAdmin: req.user?.id || null,
      lastActionAt: now,
      events: [
        {
          action: "created",
          actorRole: "ADMIN",
          actorId: req.user?.id || null,
          message: "Dispute manually created by admin",
          nextStatus: status,
          createdAt: now,
        },
      ],
    });

    return res.status(201).json(success({ dispute: toDisputeDto(dispute.toObject()) }));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json(failure("CONFLICT", "A similar dispute already exists for this order"));
    }
    console.error("Create admin dispute error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to create dispute"));
  }
};

const reviewAdminDispute = async (req, res) => {
  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) {
      return res.status(404).json(failure("NOT_FOUND", "Dispute not found"));
    }

    const action = String(req.body?.action || "start_review").trim().toLowerCase();
    const comment = String(req.body?.comment || "").trim();
    const prevStatus = dispute.status;
    let nextStatus = dispute.status;

    if (action === "start_review") nextStatus = "under_review";
    else if (action === "escalate") nextStatus = "pending_escalation";
    else if (action === "resolve") nextStatus = "resolved";
    else if (action === "dismiss") nextStatus = "dismissed";
    else if (action === "reopen") nextStatus = "under_review";
    else if (action === "comment") nextStatus = dispute.status;
    else {
      return res.status(400).json(failure("BAD_REQUEST", "Unsupported review action"));
    }

    dispute.status = nextStatus;
    dispute.assignedAdmin = req.user?.id || dispute.assignedAdmin || null;
    if (comment) {
      dispute.adminComments = dispute.adminComments
        ? `${dispute.adminComments}\n${comment}`
        : comment;
    }
    dispute.lastActionAt = new Date();
    dispute.events.push({
      action:
        action === "reopen" ? "reopened" :
        action === "comment" ? "comment" :
        action,
      actorRole: "ADMIN",
      actorId: req.user?.id || null,
      message: comment || `Admin action: ${action}`,
      previousStatus: prevStatus,
      nextStatus,
      createdAt: dispute.lastActionAt,
    });
    await dispute.save();

    return res.status(200).json(success({ dispute: toDisputeDto(dispute.toObject()) }));
  } catch (error) {
    console.error("Review admin dispute error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Failed to update dispute"));
  }
};

module.exports = {
  getAdminOverview,
  getAdminEscrowAudit,
  getAdminHubDisputes,
  advanceAdminOrderTracking,
  getAdminOrderById,
  releaseAdminBatchPayouts,
  createAdminDispute,
  reviewAdminDispute,
};
