const mongoose = require("mongoose");

const disputeEventSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["created", "start_review", "escalate", "resolve", "dismiss", "comment", "system_sync", "reopened"],
      required: true,
    },
    actorRole: { type: String, enum: ["SYSTEM", "ADMIN", "FARMER", "BUYER"], default: "SYSTEM" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    message: { type: String, trim: true, default: "" },
    previousStatus: { type: String, default: null },
    nextStatus: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const disputeSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder", index: true, default: null },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", index: true, default: null },
    hubId: { type: String, required: true, trim: true, index: true },
    hubName: { type: String, required: true, trim: true },
    region: { type: String, required: true, trim: true, index: true },
    commodity: { type: String, required: true, trim: true },
    issue: { type: String, required: true, trim: true },
    anomalyType: { type: String, required: true, trim: true, index: true },
    severity: { type: String, enum: ["high", "medium", "low"], required: true, index: true },
    status: {
      type: String,
      enum: ["pending_review", "under_review", "pending_escalation", "resolved", "dismissed"],
      default: "pending_review",
      index: true,
    },
    confidenceScore: { type: Number, default: null, min: 0, max: 100 },
    aiDetectedGrade: { type: String, default: null, trim: true },
    issueDeltaPercent: { type: Number, default: null },
    source: {
      type: String,
      enum: ["system_derived", "hub_operator", "admin_manual", "payout_failure", "payment_failure"],
      default: "system_derived",
      index: true,
    },
    operatorComments: { type: String, trim: true, default: "" },
    adminComments: { type: String, trim: true, default: "" },
    evidence: [
      {
        kind: { type: String, enum: ["image", "document", "link"], default: "image" },
        url: { type: String, trim: true, required: true },
        label: { type: String, trim: true, default: "" },
      },
    ],
    assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastActionAt: { type: Date, default: Date.now, index: true },
    events: { type: [disputeEventSchema], default: [] },
  },
  { timestamps: true },
);

disputeSchema.index(
  { order: 1, anomalyType: 1, issue: 1 },
  { unique: true, partialFilterExpression: { order: { $type: "objectId" } } },
);

module.exports = mongoose.model("Dispute", disputeSchema);

