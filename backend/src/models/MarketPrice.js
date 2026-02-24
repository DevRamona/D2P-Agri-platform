const mongoose = require("mongoose");

const marketPriceSchema = new mongoose.Schema(
  {
    cropKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    crop: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    previousPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    unit: {
      type: String,
      default: "/kg",
      trim: true,
    },
    currency: {
      type: String,
      default: "RWF",
      trim: true,
      uppercase: true,
    },
    region: {
      type: String,
      default: "Rwanda",
      trim: true,
    },
    source: {
      type: String,
      default: "manual",
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: null,
      trim: true,
    },
    changePercent: {
      type: Number,
      default: null,
    },
    asOf: {
      type: Date,
      default: Date.now,
    },
    sortOrder: {
      type: Number,
      default: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

marketPriceSchema.index({ cropKey: 1, region: 1, unit: 1, source: 1 }, { unique: true });

module.exports = mongoose.model("MarketPrice", marketPriceSchema);
