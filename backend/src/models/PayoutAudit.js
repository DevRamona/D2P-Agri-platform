const mongoose = require("mongoose");

const payoutAuditSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "BuyerOrder", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", default: null, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    provider: { type: String, enum: ["stripe", "mobile_money", "bank_transfer", "unknown"], required: true, index: true },
    method: { type: String, enum: ["card", "momo", "airtel", "bank", "unknown"], required: true, index: true },
    paymentRail: { type: String, default: "unknown", trim: true },
    executionMode: { type: String, enum: ["live", "stub"], required: true },
    status: {
      type: String,
      enum: ["pending", "submitted", "succeeded", "failed", "manual_required", "skipped"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "RWF", uppercase: true, trim: true },
    externalReference: { type: String, default: null, trim: true, index: true },
    providerCode: { type: String, default: null, trim: true },
    providerLabel: { type: String, default: null, trim: true },
    providerRequest: { type: mongoose.Schema.Types.Mixed, default: null },
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    errorCode: { type: String, default: null, trim: true },
    errorMessage: { type: String, default: null, trim: true },
    processedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayoutAudit", payoutAuditSchema);

