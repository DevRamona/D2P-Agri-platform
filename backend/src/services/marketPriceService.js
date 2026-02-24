const MarketPrice = require("../models/MarketPrice");

const DEFAULT_MARKET_PRICE_SEED = [
  {
    cropKey: "coffee",
    crop: "Arabica Coffee",
    price: 2400,
    previousPrice: 2344,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 10,
  },
  {
    cropKey: "maize",
    crop: "Maize",
    price: 650,
    previousPrice: 655,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 20,
  },
  {
    cropKey: "beans",
    crop: "Dry Beans",
    price: 900,
    previousPrice: 890,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 30,
  },
  {
    cropKey: "irish_potato",
    crop: "Irish Potatoes",
    price: 550,
    previousPrice: 530,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 40,
  },
  {
    cropKey: "onion",
    crop: "Onions",
    price: 700,
    previousPrice: 712,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 50,
  },
  {
    cropKey: "carrot",
    crop: "Carrots",
    price: 780,
    previousPrice: 760,
    unit: "/kg",
    currency: "RWF",
    region: "Rwanda",
    source: "seed-default",
    sortOrder: 60,
  },
];

let seedPromise = null;

const _calculateChangePercent = (doc) => {
  if (typeof doc.changePercent === "number" && Number.isFinite(doc.changePercent)) {
    return doc.changePercent;
  }

  const current = Number(doc.price);
  const previous = Number(doc.previousPrice);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return 0;
  }

  return ((current - previous) / previous) * 100;
};

const _formatChangePercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.0%";
  }
  const rounded = Math.round(numeric * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
};

const _formatPrice = (value) => {
  const numeric = Number(value) || 0;
  return numeric.toLocaleString("en-US");
};

const _toClientPrice = (doc) => {
  const changePercent = _calculateChangePercent(doc);
  const asOf = doc.asOf || doc.updatedAt || new Date();

  return {
    id: String(doc._id),
    crop: doc.crop,
    cropKey: doc.cropKey,
    price: _formatPrice(doc.price),
    unit: doc.unit || "/kg",
    currency: doc.currency || "RWF",
    region: doc.region || "Rwanda",
    source: doc.source || "manual",
    asOf: new Date(asOf).toISOString(),
    change: _formatChangePercent(changePercent),
    positive: changePercent >= 0,
    numericPrice: Number(doc.price) || 0,
    numericChangePercent: Math.round(changePercent * 100) / 100,
  };
};

const _sourcePriority = (doc) => (doc.source === "seed-default" ? 1 : 0);

const _seedDefaultsIfNeeded = async () => {
  const count = await MarketPrice.countDocuments({});
  if (count > 0) {
    return;
  }

  const now = new Date();
  const ops = DEFAULT_MARKET_PRICE_SEED.map((item) => ({
    updateOne: {
      filter: {
        cropKey: item.cropKey,
        region: item.region,
        unit: item.unit,
        source: item.source,
      },
      update: {
        $set: {
          ...item,
          asOf: now,
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await MarketPrice.bulkWrite(ops, { ordered: false });
  }
};

const ensureMarketPricesSeeded = async () => {
  if (!seedPromise) {
    seedPromise = _seedDefaultsIfNeeded().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  await seedPromise;
};

const getMarketPriceList = async () => {
  await ensureMarketPricesSeeded();

  const docs = await MarketPrice.find({ isActive: true })
    .lean();

  const byKey = new Map();
  for (const doc of docs) {
    const key = `${doc.cropKey || ""}|${doc.region || ""}|${doc.unit || ""}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, doc);
      continue;
    }

    const currentSourcePriority = _sourcePriority(current);
    const nextSourcePriority = _sourcePriority(doc);
    if (nextSourcePriority < currentSourcePriority) {
      byKey.set(key, doc);
      continue;
    }
    if (nextSourcePriority > currentSourcePriority) {
      continue;
    }

    const currentTime = Date.parse(current.asOf || current.updatedAt || 0) || 0;
    const nextTime = Date.parse(doc.asOf || doc.updatedAt || 0) || 0;
    if (nextTime > currentTime) {
      byKey.set(key, doc);
    }
  }

  const deduped = Array.from(byKey.values());
  deduped.sort((a, b) => {
    const sortOrderDiff = (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    if (sortOrderDiff !== 0) return sortOrderDiff;
    return String(a.crop || "").localeCompare(String(b.crop || ""));
  });

  return deduped.map(_toClientPrice);
};

const getMarketPayload = async () => {
  const marketPrices = await getMarketPriceList();
  const latestAsOf = marketPrices.reduce((latest, item) => {
    const ts = Date.parse(item.asOf);
    if (!Number.isFinite(ts)) return latest;
    return ts > latest ? ts : latest;
  }, 0);

  return {
    marketPrices,
    lastSynced: new Date(latestAsOf || Date.now()).toISOString(),
    source: "database",
    seededDefaults: marketPrices.every((item) => item.source === "seed-default"),
  };
};

module.exports = {
  DEFAULT_MARKET_PRICE_SEED,
  getMarketPayload,
  getMarketPriceList,
  ensureMarketPricesSeeded,
};
