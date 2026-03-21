const Batch = require("../models/Batch");
const BuyerOrder = require("../models/BuyerOrder");
const { User } = require("../models/User");
const {
  createBuyerOrderCheckoutSession,
  getStripeClient,
  isStripeEnabled,
} = require("../services/stripeService");
const { createMobileMoneyPaymentSessionStub } = require("../services/mobileMoneyService");
const {
  createFlutterwaveRwandaMobileMoneyCharge,
  isFlutterwaveEnabled,
  isFlutterwaveMobileMoneyMethod,
} = require("../services/flutterwaveService");
const { syncBuyerOrderWithFlutterwaveTransaction } = require("../services/flutterwaveOrderService");
const { releaseEscrowPayoutForOrder } = require("../services/adminPayoutService");
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

const _paymentMethodLabel = (method) => {
  const normalized = String(method || "").trim().toLowerCase();
  if (normalized === "card") return "Card";
  if (normalized === "momo") return "MTN Mobile Money";
  if (normalized === "airtel") return "Airtel Money";
  if (normalized === "bank") return "Bank Transfer";
  return "Card";
};

const _mobileMoneyCollectionMode = () => {
  const mode = String(process.env.MOBILE_MONEY_COLLECTION_MODE || "stub_auto_confirm")
    .trim()
    .toLowerCase();
  return mode === "stub_pending" ? "stub_pending" : "stub_auto_confirm";
};

// Keep mobile money available in stub mode by default so Rwanda-first demos
// can use MTN/Airtel checkout without live provider credentials.
const _isMobileMoneyStubEnabled = () =>
  String(process.env.ALLOW_MOBILE_MONEY_STUB || "true").trim().toLowerCase() === "true";

const _extractStripePaymentIntentId = (session) => {
  const paymentIntent = session?.payment_intent;
  if (typeof paymentIntent === "string") return paymentIntent;
  if (paymentIntent && typeof paymentIntent === "object" && paymentIntent.id) {
    return String(paymentIntent.id);
  }
  return null;
};

const _extractStripePaymentIntentStatus = (session) => {
  const paymentIntent = session?.payment_intent;
  if (paymentIntent && typeof paymentIntent === "object" && paymentIntent.status) {
    return String(paymentIntent.status).toLowerCase();
  }
  return "";
};

const _syncOrderWithStripeCheckout = async (order) => {
  if (!order || !isStripeEnabled()) return order;
  if (String(order.paymentMethod || "").toLowerCase() !== "card") return order;
  if (String(order.escrowStatus || "").toLowerCase() === "released") return order;

  const sessionId = String(order.stripeCheckoutSessionId || "").trim();
  if (!sessionId) return order;

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const paymentIntentId = _extractStripePaymentIntentId(session);
    const paymentIntentStatus = _extractStripePaymentIntentStatus(session);
    const paymentStatus = String(session?.payment_status || "").toLowerCase();
    const checkoutStatus = String(session?.status || "").toLowerCase();
    const now = new Date();
    let hasChanges = false;

    if (session?.id && session.id !== order.stripeCheckoutSessionId) {
      order.stripeCheckoutSessionId = session.id;
      hasChanges = true;
    }
    if (paymentIntentId && paymentIntentId !== order.stripePaymentIntentId) {
      order.stripePaymentIntentId = paymentIntentId;
      hasChanges = true;
    }
    const normalizedStripeStatus = paymentStatus || paymentIntentStatus || checkoutStatus;
    if (normalizedStripeStatus && normalizedStripeStatus !== order.stripePaymentStatus) {
      order.stripePaymentStatus = normalizedStripeStatus;
      hasChanges = true;
    }

    if (paymentStatus === "paid" || paymentIntentStatus === "succeeded") {
      if (order.paymentStatus !== "deposit_paid") {
        order.paymentStatus = "deposit_paid";
        hasChanges = true;
      }
      if (order.escrowStatus !== "funded") {
        order.escrowStatus = "funded";
        hasChanges = true;
      }
      if (!order.paymentConfirmedAt) {
        order.paymentConfirmedAt = now;
        hasChanges = true;
      }
      if (!order.escrowFundedAt) {
        order.escrowFundedAt = now;
        hasChanges = true;
      }
      if (order.trackingStage !== "payment_confirmed") {
        order.trackingStage = "payment_confirmed";
        hasChanges = true;
      }
      order.trackingUpdatedAt = now;
      hasChanges = true;
    } else if (checkoutStatus === "expired" && String(order.paymentStatus || "").toLowerCase() !== "deposit_paid") {
      if (order.paymentStatus !== "failed") {
        order.paymentStatus = "failed";
        hasChanges = true;
      }
      if (order.escrowStatus !== "awaiting_payment") {
        order.escrowStatus = "awaiting_payment";
        hasChanges = true;
      }
      if (order.trackingStage !== "awaiting_payment") {
        order.trackingStage = "awaiting_payment";
        hasChanges = true;
      }
      order.trackingUpdatedAt = now;
      hasChanges = true;
    }

    if (hasChanges) {
      await order.save();
      await _markBatchSoldIfFunded(order);
    }
  } catch (error) {
    console.error("Stripe checkout sync error:", {
      orderId: String(order._id),
      stripeCheckoutSessionId: sessionId,
      message: error.message,
    });
  }

  return order;
};

const _syncOrderWithFlutterwaveCheckout = async (order) => {
  if (!order || !isFlutterwaveEnabled()) return order;
  if (!isFlutterwaveMobileMoneyMethod(order.paymentMethod)) return order;
  if (String(order.escrowStatus || "").toLowerCase() === "released") return order;

  const transactionId = String(order.mobileMoneyExternalId || "").trim();
  if (!transactionId) return order;

  try {
    await syncBuyerOrderWithFlutterwaveTransaction({
      order,
      transactionId,
      receivedAt: new Date(),
    });
  } catch (error) {
    console.error("Flutterwave mobile money sync error:", {
      orderId: String(order._id),
      mobileMoneyExternalId: transactionId,
      message: error.message,
    });
  }

  return order;
};

const _syncOrderWithPaymentProvider = async (order) => {
  if (!order) return order;
  if (isFlutterwaveMobileMoneyMethod(order.paymentMethod)) {
    return _syncOrderWithFlutterwaveCheckout(order);
  }
  return _syncOrderWithStripeCheckout(order);
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

const _markBatchSoldIfFunded = async (orderLike) => {
  const batchId = orderLike?.batch?._id || orderLike?.batch;
  if (!batchId) return;

  const paymentStatus = String(orderLike?.paymentStatus || "").toLowerCase();
  const escrowStatus = String(orderLike?.escrowStatus || "").toLowerCase();
  if (paymentStatus !== "deposit_paid" || escrowStatus !== "funded") return;

  await Batch.findByIdAndUpdate(batchId, {
    $set: {
      status: "sold",
      soldAt: new Date(),
    },
  });
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
  paymentStatus: order.paymentStatus || "pending",
  trackingStage: order.trackingStage || "awaiting_payment",
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
  paymentMethod: order.paymentMethod || "card",
  escrowStatus: order.escrowStatus || "awaiting_payment",
  stripeCheckoutSessionId: order.stripeCheckoutSessionId || null,
  stripePaymentIntentId: order.stripePaymentIntentId || null,
  stripeTransferId: order.stripeTransferId || null,
  stripePaymentStatus: order.stripePaymentStatus || null,
  mobileMoneyProvider: order.mobileMoneyProvider || null,
  mobileMoneyProviderCode: order.mobileMoneyProviderCode || null,
  mobileMoneyReference: order.mobileMoneyReference || null,
  mobileMoneyExternalId: order.mobileMoneyExternalId || null,
  mobileMoneyTransactionId: order.mobileMoneyTransactionId || null,
  mobileMoneyStatus: order.mobileMoneyStatus || null,
  mobileMoneyPayerMsisdn: order.mobileMoneyPayerMsisdn || null,
  mobileMoneyLastWebhookAt: order.mobileMoneyLastWebhookAt ? new Date(order.mobileMoneyLastWebhookAt).toISOString() : null,
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
        ? `Deposit secured in escrow via ${(order.paymentMethod || "card").toUpperCase()}`
        : `Awaiting buyer deposit payment via ${_paymentMethodLabel(order.paymentMethod)}`,
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

const _advanceTrackingStage = (order) => {
  const currentStage = String(order.trackingStage || "").toLowerCase();
  const now = new Date();

  if (String(order.paymentStatus || "").toLowerCase() !== "deposit_paid" || String(order.escrowStatus || "").toLowerCase() !== "funded") {
    const error = new Error("Escrow must be funded before delivery tracking can continue");
    error.code = "ESCROW_NOT_READY";
    throw error;
  }

  if (String(order.status || "").toLowerCase() === "completed") {
    return false;
  }

  if (currentStage === "awaiting_payment") {
    order.trackingStage = "payment_confirmed";
  } else if (currentStage === "payment_confirmed") {
    order.trackingStage = "farmer_dispatching";
  } else if (currentStage === "farmer_dispatching") {
    order.trackingStage = "hub_inspection";
  } else if (currentStage === "hub_inspection") {
    order.trackingStage = "released_for_delivery";
  } else {
    return false;
  }

  order.trackingUpdatedAt = now;
  return true;
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

    const existingOrder = await BuyerOrder.findOne({
      batch: batchId,
      status: { $ne: "cancelled" },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (existingOrder) {
      return res.status(409).json(
        failure(
          "BATCH_ALREADY_ORDERED",
          `This batch already has order ${existingOrder.orderNumber || String(existingOrder._id)} in progress. Open the existing order instead of creating another one.`,
        ),
      );
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
      paymentMethod: ["card", "momo", "airtel", "bank"].includes(String(paymentMethod || "").toLowerCase())
        ? String(paymentMethod).toLowerCase()
        : "card",
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

    await _syncOrderWithPaymentProvider(order);

    if (String(order.paymentStatus) === "deposit_paid" || String(order.escrowStatus) === "funded") {
      return res.status(400).json(failure("ORDER_ALREADY_PAID", "This order deposit has already been paid"));
    }

    const buyer = await User.findById(buyerId).select("fullName email phoneNumber").lean();
    if (!buyer) {
      return res.status(404).json(failure("NOT_FOUND", "Buyer not found"));
    }

    const paymentMethod = String(order.paymentMethod || "card").toLowerCase();
    if (paymentMethod === "momo" || paymentMethod === "airtel") {
      if (isFlutterwaveEnabled()) {
        const now = new Date();
        const flutterwaveCharge = await createFlutterwaveRwandaMobileMoneyCharge({
          order: order.toObject(),
          buyer,
          method: paymentMethod,
        });

        order.mobileMoneyProvider = flutterwaveCharge.providerSlug;
        order.mobileMoneyProviderCode = flutterwaveCharge.providerCode;
        order.mobileMoneyReference = flutterwaveCharge.txRef;
        order.mobileMoneyExternalId = flutterwaveCharge.externalId;
        order.mobileMoneyTransactionId = flutterwaveCharge.flwRef;
        order.mobileMoneyStatus = flutterwaveCharge.status;
        order.mobileMoneyPayerMsisdn = buyer.phoneNumber || order.mobileMoneyPayerMsisdn;
        order.trackingUpdatedAt = now;

        if (flutterwaveCharge.status === "successful") {
          order.paymentStatus = "deposit_paid";
          order.escrowStatus = "funded";
          order.paymentConfirmedAt = now;
          order.escrowFundedAt = now;
          order.trackingStage = "payment_confirmed";
        } else {
          order.paymentStatus = "pending";
          order.escrowStatus = "awaiting_payment";
          order.trackingStage = "awaiting_payment";
        }
        await order.save();
        await _markBatchSoldIfFunded(order);

        const providerLabel = flutterwaveCharge.providerLabel || _paymentMethodLabel(paymentMethod);
        const instructions = [
          `Authorize the ${providerLabel} request on ${buyer.phoneNumber || "the buyer phone number"}.`,
          "Flutterwave will confirm the transaction before the order is marked as funded.",
          flutterwaveCharge.redirectUrl
            ? "You will be redirected back to order tracking after authorization."
            : "Return to order tracking after authorizing the mobile money prompt.",
        ];

        return res.status(200).json(
          success({
            order: _buildOrderSummaryFromDoc(order.toObject()),
            timeline: _buildTrackingTimeline(order.toObject()),
            checkout: {
              sessionId: flutterwaveCharge.externalId,
              url: flutterwaveCharge.redirectUrl,
              expiresAt: null,
              currency: String(order.currency || "RWF").toUpperCase(),
              transferGroup: order.stripeTransferGroup || null,
              kind: "mobile_money",
              method: paymentMethod,
              status: flutterwaveCharge.status,
              requiresAction: Boolean(flutterwaveCharge.redirectUrl),
              message:
                flutterwaveCharge.status === "successful"
                  ? `${providerLabel} payment was confirmed and escrow is now funded.`
                  : `${providerLabel} request created through Flutterwave. Complete payment authorization on the buyer phone.`,
              instructions,
              mobileMoney: {
                stub: false,
                provider: flutterwaveCharge.providerSlug,
                providerCode: flutterwaveCharge.providerCode,
                providerLabel: flutterwaveCharge.providerLabel,
                reference: flutterwaveCharge.txRef,
                amount: Math.round(Number(order.amountDueToday) || 0),
                currency: String(order.currency || "RWF").toUpperCase(),
                expiresAt: null,
                instructions,
              },
            },
          }),
        );
      }

      if (!_isMobileMoneyStubEnabled()) {
        return res.status(501).json(
          failure(
            "MOBILE_MONEY_NOT_CONFIGURED",
            "Flutterwave mobile money is not configured yet. Set FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_SECRET_HASH, or enable ALLOW_MOBILE_MONEY_STUB=true for local testing.",
          ),
        );
      }

      const mobileMoneySession = createMobileMoneyPaymentSessionStub({ order: order.toObject(), buyer });
      const collectionMode = _mobileMoneyCollectionMode();
      const now = new Date();

      order.mobileMoneyProvider = mobileMoneySession.mobileMoney?.provider || (paymentMethod === "momo" ? "mtn" : "airtel");
      order.mobileMoneyProviderCode = mobileMoneySession.mobileMoney?.providerCode || null;
      order.mobileMoneyReference = mobileMoneySession.mobileMoney?.reference || null;
      order.mobileMoneyStatus = collectionMode === "stub_auto_confirm" ? "successful" : "pending_provider_integration";
      order.mobileMoneyPayerMsisdn = buyer.phoneNumber || null;
      order.trackingUpdatedAt = now;
      if (collectionMode === "stub_auto_confirm") {
        order.paymentStatus = "deposit_paid";
        order.escrowStatus = "funded";
        order.paymentConfirmedAt = now;
        order.escrowFundedAt = now;
        order.trackingStage = "payment_confirmed";
      } else {
        order.paymentStatus = "pending";
        order.escrowStatus = "awaiting_payment";
        order.trackingStage = "awaiting_payment";
      }
      await order.save();
      await _markBatchSoldIfFunded(order);

      return res.status(200).json(
        success({
          order: _buildOrderSummaryFromDoc(order.toObject()),
          timeline: _buildTrackingTimeline(order.toObject()),
          checkout: {
            sessionId: null,
            url: null,
            expiresAt: mobileMoneySession.mobileMoney?.expiresAt || null,
            currency: String(order.currency || "RWF").toUpperCase(),
            transferGroup: order.stripeTransferGroup || null,
            kind: "mobile_money",
            method: paymentMethod,
            status: collectionMode === "stub_auto_confirm" ? "confirmed" : "pending_provider_integration",
            requiresAction: collectionMode === "stub_pending",
            message:
              collectionMode === "stub_auto_confirm"
                ? `${_paymentMethodLabel(paymentMethod)} payment was confirmed and escrow is now funded.`
                : (mobileMoneySession.clientAction?.message || `${_paymentMethodLabel(paymentMethod)} request created.`),
            instructions: Array.isArray(mobileMoneySession.mobileMoney?.instructions)
              ? mobileMoneySession.mobileMoney.instructions
              : [],
            mobileMoney: mobileMoneySession.mobileMoney || null,
          },
        }),
      );
    }

    if (paymentMethod === "bank") {
      return res.status(400).json(
        failure(
          "BANK_TRANSFER_MANUAL_REQUIRED",
          "Bank transfer collection is manual. Please contact support or use Card checkout.",
        ),
      );
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
    console.error("Create checkout session error:", error);
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

    await _syncOrderWithPaymentProvider(order);

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

    if (String(order.trackingStage || "").toLowerCase() !== "released_for_delivery") {
      return res
        .status(400)
        .json(failure("DELIVERY_NOT_READY", "Move the order through delivery stages before confirming receipt"));
    }

    const payoutResult = await releaseEscrowPayoutForOrder({
      order: order.toObject(),
      actorUserId: buyerId,
    });
    if (!payoutResult.ok) {
      return res.status(payoutResult.skipped ? 400 : 500).json(
        failure(
          payoutResult.skipped ? "PAYOUT_MANUAL_REQUIRED" : "ESCROW_RELEASE_FAILED",
          payoutResult.error || "Failed to release escrow",
        ),
      );
    }

    const now = new Date();
    order.escrowStatus = "released";
    order.escrowReleasedAt = payoutResult.releasedAt || now;
    order.deliveryConfirmedAt = now;
    order.completedAt = now;
    order.status = "completed";
    order.trackingStage = "delivered";
    order.trackingUpdatedAt = now;
    if (payoutResult.provider === "stripe" && payoutResult.externalReference) {
      order.stripeTransferId = payoutResult.externalReference;
    }
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

const advanceOrderTracking = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const order = await BuyerOrder.findOne({ _id: req.params.id, buyer: buyerId });

    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    await _syncOrderWithPaymentProvider(order);

    if (String(order.status || "").toLowerCase() === "completed") {
      return res.status(200).json(
        success({
          order: _buildOrderSummaryFromDoc(order.toObject()),
          timeline: _buildTrackingTimeline(order.toObject()),
        }),
      );
    }

    const changed = _advanceTrackingStage(order);
    if (changed) {
      await order.save();
    }

    return res.status(200).json(
      success({
        order: _buildOrderSummaryFromDoc(order.toObject()),
        timeline: _buildTrackingTimeline(order.toObject()),
      }),
    );
  } catch (error) {
    if (error.code === "ESCROW_NOT_READY") {
      return res.status(400).json(failure("ESCROW_NOT_READY", error.message));
    }
    console.error("Advance order tracking error:", error);
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
    const order = await BuyerOrder.findOne({ _id: req.params.id, buyer: buyerId });

    if (!order) {
      return res.status(404).json(failure("NOT_FOUND", "Order not found"));
    }

    await _syncOrderWithPaymentProvider(order);
    await _markBatchSoldIfFunded(order);
    const orderObject = order.toObject();

    return res.status(200).json(
      success({
        order: _buildOrderSummaryFromDoc(orderObject),
        timeline: _buildTrackingTimeline(orderObject),
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
  advanceOrderTracking,
  createCheckoutSession,
  createOrder,
  getOrderById,
  getOrders,
  getProfile,
  getMarketplace,
  releaseEscrow,
};
