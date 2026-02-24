const Batch = require("../models/Batch");
const BuyerOrder = require("../models/BuyerOrder");
const { User } = require("../models/User");
const {
  createBuyerOrderCheckoutSession,
  createEscrowReleaseTransfer,
  isStripeEnabled,
} = require("../services/stripeService");
const { success, failure } = require("../utils/response");

const _normalizeCropKey = (name) => {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return "mixed";
  if (normalized.includes("bean")) return "beans";
  if (normalized.includes("maize") || normalized.includes("corn")) return "maize";
  if (normalized.includes("coffee")) return "coffee";
  if (normalized.includes("potato")) return "potatoes";
  if (normalized.includes("onion")) return "onions";
  if (normalized.includes("carrot")) return "carrots";
  return normalized.replace(/\s+/g, "_");
};

const _toAbsoluteUploadPath = (imagePath) => {
  if (!imagePath) return null;
  return String(imagePath);
};

const _pickPrimaryImage = (batch) => {
  for (const entry of batch.products || []) {
    const product = entry?.product;
    if (product && typeof product === "object" && product.image) {
      return _toAbsoluteUploadPath(product.image);
    }
  }
  return null;
};

const _buildTitle = (productNames) => {
  if (productNames.length === 0) {
    return "Farmer Produce Batch";
  }
  if (productNames.length === 1) {
    return `${productNames[0]} Batch`;
  }
  if (productNames.length === 2) {
    return `${productNames[0]} + ${productNames[1]}`;
  }
  return `${productNames[0]} + ${productNames.length - 1} more crops`;
};

const _deriveQualityTag = (batch) => {
  const status = String(batch.status || "").toLowerCase();
  if (status === "active") return "Available";
  if (status === "sold") return "Sold";
  if (status === "draft") return "Draft";
  return "Listed";
};

const _calculateOrderQuote = (totalPrice, options = {}) => {
  const normalizedTotal = Math.max(0, Number(totalPrice) || 0);
  const depositPercent = typeof options.depositPercent === "number" ? options.depositPercent : 0.6;
  const serviceFeeRate = typeof options.serviceFeeRate === "number" ? options.serviceFeeRate : 0.01;
  const serviceFeeMinimum = typeof options.serviceFeeMinimum === "number" ? options.serviceFeeMinimum : 5000;
  const insuranceFee = typeof options.insuranceFee === "number" ? options.insuranceFee : 0;

  const depositAmount = Math.round(normalizedTotal * depositPercent);
  const balanceDue = Math.max(0, normalizedTotal - depositAmount);
  const serviceFee = normalizedTotal > 0 ? Math.max(serviceFeeMinimum, Math.round(normalizedTotal * serviceFeeRate)) : 0;
  const amountDueToday = depositAmount + serviceFee + insuranceFee;

  return {
    depositPercent,
    depositAmount,
    balanceDue,
    serviceFee,
    insuranceFee,
    amountDueToday,
  };
};

const _generateOrderNumber = async () => {
  for (let i = 0; i < 5; i += 1) {
    const suffix = Math.floor(100000 + Math.random() * 900000);
    const candidate = `AG-${suffix}`;
    const exists = await BuyerOrder.exists({ orderNumber: candidate });
    if (!exists) {
      return candidate;
    }
  }

  return `AG-${Date.now().toString().slice(-6)}`;
};

const _buildOrderSummaryFromDoc = (order) => ({
  id: String(order._id),
  orderNumber: order.orderNumber,
  title: order.title,
  cropKey: order.cropKey || "mixed",
  cropNames: Array.isArray(order.cropNames) ? order.cropNames : [],
  farmerName: order.farmerName || "Farmer",
  destination: order.destination || "Kigali Central Aggregator",
  status: order.status || "active",
  paymentStatus: order.paymentStatus || "deposit_paid",
  trackingStage: order.trackingStage || "hub_inspection",
  image: order.image || null,
  totalWeight: Number(order.totalWeight) || 0,
  totalPrice: Number(order.totalPrice) || 0,
  pricePerKg: Number(order.pricePerKg) || 0,
  currency: String(order.currency || "RWF").toUpperCase(),
  depositPercent: Number(order.depositPercent) || 0.6,
  depositAmount: Number(order.depositAmount) || 0,
  balanceDue: Number(order.balanceDue) || 0,
  serviceFee: Number(order.serviceFee) || 0,
  insuranceFee: Number(order.insuranceFee) || 0,
  amountDueToday: Number(order.amountDueToday) || 0,
  paymentMethod: order.paymentMethod || "momo",
  escrowStatus: order.escrowStatus || "awaiting_payment",
  stripeCheckoutSessionId: order.stripeCheckoutSessionId || null,
  stripePaymentIntentId: order.stripePaymentIntentId || null,
  stripeTransferId: order.stripeTransferId || null,
  stripePaymentStatus: order.stripePaymentStatus || null,
  estimatedArrivalAt: order.estimatedArrivalAt ? new Date(order.estimatedArrivalAt).toISOString() : null,
  trackingUpdatedAt: order.trackingUpdatedAt ? new Date(order.trackingUpdatedAt).toISOString() : null,
  paymentConfirmedAt: order.paymentConfirmedAt ? new Date(order.paymentConfirmedAt).toISOString() : null,
  escrowFundedAt: order.escrowFundedAt ? new Date(order.escrowFundedAt).toISOString() : null,
  escrowReleasedAt: order.escrowReleasedAt ? new Date(order.escrowReleasedAt).toISOString() : null,
  deliveryConfirmedAt: order.deliveryConfirmedAt ? new Date(order.deliveryConfirmedAt).toISOString() : null,
  createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : null,
  updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : null,
});

const _buildTrackingTimeline = (order) => {
  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const trackingUpdatedAt = order.trackingUpdatedAt ? new Date(order.trackingUpdatedAt) : new Date();
  const isPaymentConfirmed = String(order.paymentStatus || "").toLowerCase() === "deposit_paid";

  const stages = [
    {
      key: "payment_confirmed",
      title: "Payment Confirmed",
      detail: isPaymentConfirmed
        ? `Deposit secured in escrow via ${(order.paymentMethod || "momo").toUpperCase()}`
        : "Awaiting buyer deposit payment in Stripe Checkout",
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
      time: order.completedAt ? new Date(order.completedAt).toLocaleString() : "Pending buyer confirmation",
    },
  ];

  const stageOrder = stages.map((item) => item.key);
  const currentIndex = isPaymentConfirmed
    ? Math.max(0, stageOrder.indexOf(order.trackingStage || "payment_confirmed"))
    : -1;

  return stages.map((stage, index) => ({
    ...stage,
    status: !isPaymentConfirmed
      ? "pending"
      : index < currentIndex
        ? "done"
        : index === currentIndex
          ? (order.status === "cancelled" ? "pending" : "active")
          : "pending",
    updatedAt: trackingUpdatedAt.toISOString(),
  }));
};

const getMarketplace = async (req, res) => {
  try {
    const searchQuery = String(req.query.q || "").trim().toLowerCase();
    const cropFilter = String(req.query.crop || "all").trim().toLowerCase();

    const activeBatches = await Batch.find({ status: "active" })
      .populate("farmer", "fullName")
      .populate("products.product", "name unit image")
      .sort({ createdAt: -1 })
      .lean();

    const mapped = activeBatches.map((batch) => {
      const products = (batch.products || [])
        .map((entry) => ({
          quantity: Number(entry?.quantity) || 0,
          product:
            entry?.product && typeof entry.product === "object"
              ? {
                  id: String(entry.product._id),
                  name: entry.product.name || "Crop",
                  unit: entry.product.unit || "kg",
                  image: entry.product.image || null,
                }
              : null,
        }))
        .filter((entry) => entry.product);

      const productNames = Array.from(new Set(products.map((entry) => entry.product.name)));
      const dominantName = productNames[0] || "Produce";
      const cropKey = productNames.length <= 1 ? _normalizeCropKey(dominantName) : "mixed";
      const totalWeight = Number(batch.totalWeight) || 0;
      const totalPrice = Number(batch.totalPrice) || 0;
      const pricePerKg = totalWeight > 0 ? totalPrice / totalWeight : 0;

      return {
        id: String(batch._id),
        title: _buildTitle(productNames),
        cropKey,
        cropNames: productNames,
        farmerName:
          batch.farmer && typeof batch.farmer === "object" && batch.farmer.fullName
            ? batch.farmer.fullName
            : "Farmer",
        destination: batch.destination || "Kigali Central Aggregator",
        status: String(batch.status || "active"),
        tag: _deriveQualityTag(batch),
        image: _pickPrimaryImage(batch),
        totalWeight,
        totalPrice,
        pricePerKg: Math.round(pricePerKg),
        createdAt: batch.createdAt ? new Date(batch.createdAt).toISOString() : new Date().toISOString(),
        productCount: products.length,
        products,
        aiScore: null,
      };
    });

    const filtered = mapped.filter((item) => {
      const cropMatches = cropFilter === "all" || item.cropKey === cropFilter;
      if (!cropMatches) return false;

      if (!searchQuery) return true;
      const haystack = [
        item.title,
        item.farmerName,
        item.destination,
        ...item.cropNames,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchQuery);
    });

    const cropCounts = mapped.reduce((acc, item) => {
      acc[item.cropKey] = (acc[item.cropKey] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json(
      success({
        total: filtered.length,
        allCount: mapped.length,
        filters: {
          crop: cropFilter,
          q: searchQuery,
        },
        categories: [
          { key: "all", label: "All Crops", count: mapped.length },
          { key: "maize", label: "Maize", count: cropCounts.maize || 0 },
          { key: "beans", label: "Beans", count: cropCounts.beans || 0 },
          { key: "coffee", label: "Coffee", count: cropCounts.coffee || 0 },
        ],
        batches: filtered,
        lastSynced: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Buyer marketplace error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const createOrder = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { batchId, paymentMethod } = req.body || {};

    if (!batchId) {
      return res.status(400).json(failure("BAD_REQUEST", "batchId is required"));
    }

    const [buyer, batch] = await Promise.all([
      User.findById(buyerId).select("fullName"),
      Batch.findById(batchId)
        .populate("farmer", "fullName")
        .populate("products.product", "name unit image")
        .lean(),
    ]);

    if (!buyer) {
      return res.status(404).json(failure("NOT_FOUND", "Buyer not found"));
    }
    if (!batch) {
      return res.status(404).json(failure("NOT_FOUND", "Batch not found"));
    }
    if (String(batch.status) !== "active") {
      return res.status(400).json(failure("INVALID_BATCH_STATUS", "Only active farmer batches can be ordered"));
    }

    const products = (batch.products || [])
      .map((entry) => ({
        quantity: Number(entry?.quantity) || 0,
        product: entry?.product && typeof entry.product === "object" ? entry.product : null,
      }))
      .filter((entry) => entry.product);
    const productNames = Array.from(new Set(products.map((entry) => entry.product.name || "Crop").filter(Boolean)));
    const dominantName = productNames[0] || "Produce";
    const cropKey = productNames.length <= 1 ? _normalizeCropKey(dominantName) : "mixed";
    const totalWeight = Number(batch.totalWeight) || 0;
    const totalPrice = Number(batch.totalPrice) || 0;
    const pricePerKg = totalWeight > 0 ? Math.round(totalPrice / totalWeight) : 0;
    const quote = _calculateOrderQuote(totalPrice);
    const orderNumber = await _generateOrderNumber();
    const stripeTransferGroup = `buyer_order_${orderNumber}`;

    const createdOrder = await BuyerOrder.create({
      orderNumber,
      buyer: buyerId,
      farmer: batch.farmer && typeof batch.farmer === "object" ? batch.farmer._id : batch.farmer,
      batch: batch._id,
      title: _buildTitle(productNames),
      cropKey,
      cropNames: productNames,
      image: _pickPrimaryImage(batch),
      destination: batch.destination || "Kigali Central Aggregator",
      farmerName: batch.farmer && typeof batch.farmer === "object" ? batch.farmer.fullName || "Farmer" : "Farmer",
      buyerName: buyer.fullName || "Buyer",
      totalWeight,
      totalPrice,
      pricePerKg,
      currency: "RWF",
      paymentMethod: ["momo", "airtel", "bank"].includes(String(paymentMethod || "").toLowerCase())
        ? String(paymentMethod).toLowerCase()
        : "momo",
      paymentStatus: "pending",
      escrowStatus: "awaiting_payment",
      trackingStage: "awaiting_payment",
      stripeTransferGroup,
      estimatedArrivalAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      trackingUpdatedAt: new Date(),
      ...quote,
    });

    const orderSummary = _buildOrderSummaryFromDoc(createdOrder.toObject());
    return res.status(201).json(
      success({
        order: orderSummary,
        timeline: _buildTrackingTimeline(createdOrder.toObject()),
      }),
    );
  } catch (error) {
    console.error("Create buyer order error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const createCheckoutSession = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const order = await BuyerOrder.findOne({ _id: req.params.id, buyer: buyerId });

    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    if (!isStripeEnabled()) {
      return res
        .status(503)
        .json(
          failure(
            "STRIPE_NOT_CONFIGURED",
            "Stripe is not configured on the backend. Set STRIPE_SECRET_KEY and checkout URLs.",
          ),
        );
    }

    if (String(order.paymentStatus) === "deposit_paid" || String(order.escrowStatus) === "funded") {
      return res.status(400).json(failure("ORDER_ALREADY_PAID", "This order deposit has already been paid"));
    }

    const buyer = await User.findById(buyerId).select("fullName email").lean();
    if (!buyer) {
      return res.status(404).json(failure("NOT_FOUND", "Buyer not found"));
    }

    const checkout = await createBuyerOrderCheckoutSession({ order, buyer });

    order.stripeCheckoutSessionId = checkout.sessionId;
    order.stripeTransferGroup = checkout.transferGroup || order.stripeTransferGroup;
    order.stripePaymentStatus = "checkout_created";
    order.trackingUpdatedAt = new Date();
    await order.save();

    return res.status(200).json(
      success({
        order: _buildOrderSummaryFromDoc(order.toObject()),
        checkout,
      }),
    );
  } catch (error) {
    console.error("Create Stripe checkout session error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", error.message || "Internal server error"));
  }
};

const releaseEscrow = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const order = await BuyerOrder.findOne({ _id: req.params.id, buyer: buyerId });

    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    if (!isStripeEnabled()) {
      return res.status(503).json(failure("STRIPE_NOT_CONFIGURED", "Stripe is not configured on the backend"));
    }

    if (String(order.paymentStatus) !== "deposit_paid" || String(order.escrowStatus) !== "funded") {
      if (String(order.escrowStatus) === "released") {
        return res.status(200).json(
          success({
            order: _buildOrderSummaryFromDoc(order.toObject()),
            timeline: _buildTrackingTimeline(order.toObject()),
          }),
        );
      }

      return res
        .status(400)
        .json(failure("ESCROW_NOT_READY", "Escrow funds are not yet available for release"));
    }

    const farmer = await User.findById(order.farmer).select("fullName stripeConnectAccountId").lean();
    if (!farmer) {
      return res.status(404).json(failure("NOT_FOUND", "Farmer not found"));
    }

    if (!farmer.stripeConnectAccountId) {
      return res.status(400).json(
        failure(
          "FARMER_PAYOUT_NOT_CONFIGURED",
          "Farmer payout account is not configured for Stripe Connect. Add stripeConnectAccountId to release escrow.",
        ),
      );
    }

    const transfer = await createEscrowReleaseTransfer({
      order: order.toObject(),
      farmerStripeAccountId: farmer.stripeConnectAccountId,
    });

    const now = new Date();
    order.escrowStatus = "released";
    order.escrowReleasedAt = now;
    order.deliveryConfirmedAt = now;
    order.completedAt = now;
    order.status = "completed";
    order.trackingStage = "delivered";
    order.trackingUpdatedAt = now;
    order.stripeTransferId = transfer.id;
    await order.save();

    return res.status(200).json(
      success({
        order: _buildOrderSummaryFromDoc(order.toObject()),
        timeline: _buildTrackingTimeline(order.toObject()),
      }),
    );
  } catch (error) {
    console.error("Release escrow error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", error.message || "Internal server error"));
  }
};

const getOrders = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const statusFilter = String(req.query.status || "all").trim().toLowerCase();

    const query = { buyer: buyerId };
    if (statusFilter === "completed") query.status = "completed";
    if (statusFilter === "in_progress" || statusFilter === "active") query.status = "active";
    if (statusFilter === "cancelled") query.status = "cancelled";

    const orders = await BuyerOrder.find(query).sort({ createdAt: -1 }).lean();
    const allBuyerOrders = statusFilter === "all"
      ? orders
      : await BuyerOrder.find({ buyer: buyerId }).select("totalPrice totalWeight status").lean();

    const totalSpent = allBuyerOrders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0);
    const totalVolume = allBuyerOrders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (Number(order.totalWeight) || 0), 0);

    const counts = allBuyerOrders.reduce(
      (acc, order) => {
        const key = String(order.status || "active");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { active: 0, completed: 0, cancelled: 0 },
    );

    return res.status(200).json(
      success({
        totals: {
          totalSpent,
          totalVolume,
          totalOrders: allBuyerOrders.length,
          activeOrders: counts.active || 0,
          completedOrders: counts.completed || 0,
          cancelledOrders: counts.cancelled || 0,
        },
        filters: {
          status: statusFilter,
        },
        orders: orders.map(_buildOrderSummaryFromDoc),
        lastSynced: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Buyer order history error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const getOrderById = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const order = await BuyerOrder.findOne({ _id: req.params.id, buyer: buyerId }).lean();

    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    return res.status(200).json(
      success({
        order: _buildOrderSummaryFromDoc(order),
        timeline: _buildTrackingTimeline(order),
      }),
    );
  } catch (error) {
    console.error("Buyer order detail error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

const getProfile = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const [buyer, orders] = await Promise.all([
      User.findById(buyerId).select("fullName phoneNumber email role createdAt").lean(),
      BuyerOrder.find({ buyer: buyerId }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    if (!buyer) {
      return res.status(404).json(failure("NOT_FOUND", "Buyer not found"));
    }

    const allOrders = await BuyerOrder.find({ buyer: buyerId })
      .select("totalPrice totalWeight status createdAt")
      .lean();

    const totalSpent = allOrders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0);
    const totalVolume = allOrders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + (Number(order.totalWeight) || 0), 0);
    const activeOrders = allOrders.filter((order) => order.status === "active").length;
    const completedOrders = allOrders.filter((order) => order.status === "completed").length;

    return res.status(200).json(
      success({
        buyer: {
          id: String(buyer._id),
          fullName: buyer.fullName,
          phoneNumber: buyer.phoneNumber || "",
          email: buyer.email || "",
          role: buyer.role,
          createdAt: buyer.createdAt ? new Date(buyer.createdAt).toISOString() : null,
        },
        summary: {
          totalSpent,
          totalVolume,
          totalOrders: allOrders.length,
          activeOrders,
          completedOrders,
          averageOrderValue:
            allOrders.length > 0 ? Math.round(totalSpent / Math.max(1, allOrders.filter((o) => o.status !== "cancelled").length)) : 0,
        },
        recentOrders: orders.map(_buildOrderSummaryFromDoc),
        lastSynced: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Buyer profile error:", error);
    return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
  }
};

module.exports = {
  createCheckoutSession,
  createOrder,
  getOrderById,
  getOrders,
  getProfile,
  getMarketplace,
  releaseEscrow,
};
