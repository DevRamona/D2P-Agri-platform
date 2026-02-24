const mongoose = require("mongoose");

const buyerOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true, trim: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch", required: true, index: true },

    title: { type: String, required: true, trim: true },
    cropKey: { type: String, default: "mixed", trim: true, lowercase: true },
    cropNames: [{ type: String, trim: true }],
    image: { type: String, default: null, trim: true },
    destination: { type: String, default: "Kigali Central Aggregator", trim: true },

    farmerName: { type: String, required: true, trim: true },
    buyerName: { type: String, required: true, trim: true },

    totalWeight: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    pricePerKg: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "RWF", uppercase: true, trim: true },

    depositPercent: { type: Number, required: true, default: 0.6, min: 0, max: 1 },
    depositAmount: { type: Number, required: true, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, default: 0, min: 0 },
    insuranceFee: { type: Number, required: true, default: 0, min: 0 },
    amountDueToday: { type: Number, required: true, min: 0 },

    paymentMethod: { type: String, enum: ["momo", "airtel", "bank"], default: "momo" },
    paymentStatus: {
      type: String,
      enum: ["pending", "deposit_paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    escrowStatus: {
      type: String,
      enum: ["awaiting_payment", "funded", "released", "refunded", "release_failed"],
      default: "awaiting_payment",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    trackingStage: {
      type: String,
      enum: [
        "awaiting_payment",
        "payment_confirmed",
        "farmer_dispatching",
        "hub_inspection",
        "released_for_delivery",
        "delivered",
        "cancelled",
      ],
      default: "awaiting_payment",
      index: true,
    },
    stripeCheckoutSessionId: { type: String, default: null, index: true },
    stripePaymentIntentId: { type: String, default: null, index: true },
    stripeChargeId: { type: String, default: null },
    stripeTransferId: { type: String, default: null },
    stripeTransferGroup: { type: String, default: null, index: true },
    stripePaymentStatus: { type: String, default: null },
    trackingUpdatedAt: { type: Date, default: Date.now },
    estimatedArrivalAt: { type: Date, default: null },
    paymentConfirmedAt: { type: Date, default: null },
    escrowFundedAt: { type: Date, default: null },
    escrowReleasedAt: { type: Date, default: null },
    deliveryConfirmedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

buyerOrderSchema.index({ buyer: 1, createdAt: -1 });

module.exports = mongoose.model("BuyerOrder", buyerOrderSchema);
