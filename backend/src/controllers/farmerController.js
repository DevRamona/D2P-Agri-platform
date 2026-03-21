const { success, failure } = require("../utils/response");
const Product = require("../models/Product");
const Batch = require("../models/Batch");
const BuyerOrder = require("../models/BuyerOrder");
const { User } = require("../models/User");
const { getMarketPayload } = require("../services/marketPriceService");
const { generateDiseaseBatch } = require("../services/disease/mlInferenceClient");
const crypto = require("crypto");
const fs = require("fs");

const _toIsoString = (value) => (value ? new Date(value).toISOString() : null);

const _toFarmerDashboardOrder = (order) => ({
    id: String(order._id),
    orderNumber: order.orderNumber || null,
    batchId: order.batch ? String(order.batch) : null,
    title: order.title || "Produce Order",
    buyerName: order.buyerName || "Buyer",
    destination: order.destination || "Kigali Central Aggregator",
    totalWeight: Number(order.totalWeight) || 0,
    totalPrice: Number(order.totalPrice) || 0,
    status: order.status || "active",
    paymentStatus: order.paymentStatus || "pending",
    escrowStatus: order.escrowStatus || "awaiting_payment",
    trackingStage: order.trackingStage || "awaiting_payment",
    trackingUpdatedAt: _toIsoString(order.trackingUpdatedAt),
    createdAt: _toIsoString(order.createdAt),
});

const _toFarmerDashboardBatch = (batch) => ({
    id: String(batch._id),
    batchId: String(batch._id),
    status: batch.status || "active",
    totalWeight: Number(batch.totalWeight) || 0,
    totalPrice: Number(batch.totalPrice) || 0,
    destination: batch.destination || "Kigali Central Aggregator",
    soldAt: _toIsoString(batch.soldAt),
    createdAt: _toIsoString(batch.createdAt),
    products: (batch.products || []).map((entry) => ({
        quantity: Number(entry?.quantity) || 0,
        product: entry?.product || null,
    })),
});

// Helper to generate deterministic mock data based on image content
const calculateMockQuality = (buffer) => {
    // Create a hash of the image to ensure same image = same results
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const numHash = parseInt(hash.substring(0, 8), 16); // Use first 8 chars for number

    // Moisture: Range 12.0% - 16.0%
    const moistureRaw = 12.0 + (numHash % 40) / 10;
    const moisture = moistureRaw.toFixed(1) + "%";

    // Grade: A (50%), B (30%), C (20%)
    const gradeHash = numHash % 100;
    let grade = "Grade A";
    if (gradeHash > 80) grade = "Grade C";
    else if (gradeHash > 50) grade = "Grade B";

    // Fallback Disease (if ML unavailable): 70% Healthy, 30% Random Disease
    const diseases = ["bean_rust", "angular_leaf_spot"];
    const isHealthy = (numHash % 10) < 7;
    const fallbackDisease = isHealthy ? "healthy" : diseases[numHash % diseases.length];

    return { moisture, grade, fallbackDisease };
};

const getDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        const [farmer, activeBatches, soldBatches, inProgressOrders, marketPayload] = await Promise.all([
            User.findById(userId).select("fullName phoneNumber email role createdAt").lean(),
            Batch.find({ farmer: userId, status: "active" })
                .populate("products.product", "name unit image")
                .sort({ createdAt: -1 })
                .lean(),
            Batch.find({ farmer: userId, status: "sold" })
                .populate("products.product", "name unit image")
                .sort({ soldAt: -1, createdAt: -1 })
                .lean(),
            BuyerOrder.find({
                farmer: userId,
                status: "active",
                trackingStage: { $ne: "awaiting_payment" },
            })
                .sort({ trackingUpdatedAt: -1, createdAt: -1 })
                .lean(),
            getMarketPayload(),
        ]);

        if (!farmer) {
            return res.status(404).json(failure("NOT_FOUND", "Farmer account not found"));
        }

        const totalEarnings = soldBatches.reduce((sum, batch) => sum + batch.totalPrice, 0);
        const earningsChange = "+0% vs last month";

        const dashboardData = {
            account: {
                id: String(farmer._id),
                fullName: farmer.fullName || "Farmer",
                phoneNumber: farmer.phoneNumber || "",
                email: farmer.email || "",
                role: farmer.role || "FARMER",
                createdAt: _toIsoString(farmer.createdAt),
            },
            totalEarnings,
            earningsChange,
            activeBatches: activeBatches.map(_toFarmerDashboardBatch),
            inProgressOrders: inProgressOrders.map(_toFarmerDashboardOrder),
            recentlySoldBatches: soldBatches.slice(0, 4).map(_toFarmerDashboardBatch),
            marketPrices: marketPayload.marketPrices.map((item) => ({
                crop: item.crop,
                price: item.price,
                unit: item.unit,
                change: item.change,
                positive: item.positive,
            })),
            lastSynced: new Date().toISOString(),
        };

        return res.status(200).json(success(dashboardData));
    } catch (error) {
        console.error("Dashboard error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const getMarket = async (req, res) => {
    try {
        const marketPayload = await getMarketPayload();
        return res.status(200).json(success(marketPayload));
    } catch (error) {
        console.error("Market data error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const _formatWalletActivityTitle = (batch) => {
    const names = (batch.products || [])
        .map((entry) => entry?.product?.name)
        .filter(Boolean);

    if (names.length === 0) {
        return batch.status === "sold" ? "Produce Payout" : "Produce Delivery Payment";
    }

    if (names.length === 1) {
        return batch.status === "sold"
            ? `${names[0]} Payout`
            : `${names[0]} Delivery Payment`;
    }

    return batch.status === "sold" ? "Mixed Produce Payout" : "Mixed Produce Delivery Payment";
};

const getWallet = async (req, res) => {
    try {
        const userId = req.user.id;

        const [soldBatches, activeBatches, recentBatches] = await Promise.all([
            Batch.find({ farmer: userId, status: "sold" })
                .populate("products.product", "name")
                .sort({ soldAt: -1, createdAt: -1 }),
            Batch.find({ farmer: userId, status: "active" })
                .populate("products.product", "name")
                .sort({ createdAt: -1 }),
            Batch.find({ farmer: userId, status: { $in: ["sold", "active"] } })
                .populate("products.product", "name")
                .sort({ soldAt: -1, createdAt: -1 })
                .limit(10),
        ]);

        const totalEarned = soldBatches.reduce((sum, batch) => sum + (Number(batch.totalPrice) || 0), 0);
        const pendingPayout = activeBatches.reduce((sum, batch) => sum + (Number(batch.totalPrice) || 0), 0);

        // No withdrawal ledger exists yet; available balance mirrors earned payouts.
        const availableBalance = totalEarned;

        const recentActivity = recentBatches.map((batch) => {
            const isSold = batch.status === "sold";
            const amount = Number(batch.totalPrice) || 0;
            const occurredAt = isSold && batch.soldAt ? batch.soldAt : batch.createdAt;

            return {
                id: String(batch._id),
                title: _formatWalletActivityTitle(batch),
                amount,
                direction: "credit",
                status: isSold ? "completed" : "processing",
                reference: `Batch ${String(batch._id).slice(-6).toUpperCase()}`,
                occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
            };
        });

        const walletData = {
            currency: "RWF",
            availableBalance,
            totalEarned,
            pendingPayout,
            recentActivity,
            lastSynced: new Date().toISOString(),
        };

        return res.status(200).json(success(walletData));
    } catch (error) {
        console.error("Wallet error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const getInventory = async (req, res) => {
    try {
        const products = await Product.find({ farmer: req.user.id }).sort({ dateAdded: -1 });
        return res.status(200).json(success(products));
    } catch (error) {
        console.error("Get inventory error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const addProduct = async (req, res) => {
    try {
        const { name, quantity, unit, pricePerUnit } = req.body;
        let image = req.body.image;

        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        const newProduct = new Product({
            farmer: req.user.id,
            name,
            quantity,
            unit,
            pricePerUnit,
            image
        });

        await newProduct.save();
        return res.status(201).json(success(newProduct));
    } catch (error) {
        console.error("Add product error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const createBatch = async (req, res) => {
    try {
        console.log("Create Batch Payload:", JSON.stringify(req.body, null, 2));
        const { products, totalWeight, totalPrice, destination } = req.body;

        const newBatch = new Batch({
            farmer: req.user.id,
            products,
            totalWeight,
            totalPrice,
            destination
        });

        await newBatch.save();
        return res.status(201).json(success(newBatch));
    } catch (error) {
        console.error("Create batch error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", error.message));
    }
};

const getBatchById = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id)
            .populate('products.product', 'name unit image');

        if (!batch) {
            return res.status(404).json(failure("NOT_FOUND", "Batch not found"));
        }

        if (batch.farmer.toString() !== req.user.id) {
            return res.status(403).json(failure("FORBIDDEN", "You do not have permission to view this batch"));
        }

        const latestOrder = await BuyerOrder.findOne({ batch: batch._id, farmer: req.user.id })
            .sort({ createdAt: -1 })
            .lean();
        const batchPayload = batch.toObject();

        if (latestOrder) {
            batchPayload.deliveryOrder = {
                id: String(latestOrder._id),
                orderNumber: latestOrder.orderNumber || null,
                status: latestOrder.status || "active",
                paymentStatus: latestOrder.paymentStatus || "pending",
                escrowStatus: latestOrder.escrowStatus || "awaiting_payment",
                trackingStage: latestOrder.trackingStage || "awaiting_payment",
                trackingUpdatedAt: latestOrder.trackingUpdatedAt ? new Date(latestOrder.trackingUpdatedAt).toISOString() : null,
            };
        } else {
            batchPayload.deliveryOrder = null;
        }

        return res.status(200).json(success(batchPayload));
    } catch (error) {
        console.error("Get batch error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const advanceBatchDelivery = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json(failure("NOT_FOUND", "Batch not found"));
        }

        if (String(batch.farmer) !== String(req.user.id)) {
            return res.status(403).json(failure("FORBIDDEN", "You do not have permission to update this batch"));
        }

        const order = await BuyerOrder.findOne({ batch: batch._id, farmer: req.user.id }).sort({ createdAt: -1 });
        if (!order) {
            return res.status(404).json(failure("NOT_FOUND", "No delivery order found for this batch"));
        }

        if (String(order.paymentStatus || "").toLowerCase() !== "deposit_paid" || String(order.escrowStatus || "").toLowerCase() !== "funded") {
            return res.status(400).json(failure("ESCROW_NOT_READY", "Buyer payment must be funded before dispatching to hub"));
        }

        const currentStage = String(order.trackingStage || "").toLowerCase();
        if (currentStage === "payment_confirmed") {
            order.trackingStage = "farmer_dispatching";
            order.trackingUpdatedAt = new Date();
            await order.save();
        } else if (currentStage !== "farmer_dispatching" && currentStage !== "hub_inspection" && currentStage !== "released_for_delivery" && currentStage !== "delivered") {
            return res.status(400).json(failure("INVALID_TRACKING_STAGE", "This order cannot be dispatched yet"));
        }

        return res.status(200).json(success({
            batchId: String(batch._id),
            order: {
                id: String(order._id),
                orderNumber: order.orderNumber || null,
                status: order.status || "active",
                paymentStatus: order.paymentStatus || "pending",
                escrowStatus: order.escrowStatus || "awaiting_payment",
                trackingStage: order.trackingStage || "awaiting_payment",
                trackingUpdatedAt: order.trackingUpdatedAt ? new Date(order.trackingUpdatedAt).toISOString() : null,
            },
        }));
    } catch (error) {
        console.error("Advance batch delivery error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

const scanQuality = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json(failure("BAD_REQUEST", "Image file is required"));
        }

        // Handle DiskStorage: Read file from path if buffer is missing
        let fileBuffer;
        if (req.file.buffer) {
            fileBuffer = req.file.buffer;
        } else if (req.file.path) {
            // Read from disk
            try {
                fileBuffer = fs.readFileSync(req.file.path);
            } catch (readError) {
                console.error("Error reading file from disk:", readError);
                return res.status(500).json(failure("INTERNAL_ERROR", "Failed to process image file"));
            }
        } else {
            console.error("No file buffer or path found in request");
            return res.status(500).json(failure("INTERNAL_ERROR", "File upload failed"));
        }

        // 1. Generate Deterministic Mock Data
        const { moisture, grade, fallbackDisease } = calculateMockQuality(fileBuffer);

        // 2. Call ML Service (PaLiGemma generator) via shared client
        let mlResult = null;
        let usedFallback = false;

        try {
            const files = [
                {
                    buffer: fileBuffer,
                    mimetype: req.file.mimetype,
                    originalname: req.file.originalname || "scan.jpg",
                },
            ];

            const [generated] = await generateDiseaseBatch({
                files,
                cropHint: req.body.cropHint || null,
                mode: "scanQuality",
            });

            if (generated) {
                mlResult = generated;
            } else {
                usedFallback = true;
            }
        } catch (mlError) {
            console.error("Failed to connect to ML Service:", mlError);
            usedFallback = true;
        }

        // 4. Apply Fallback if ML failed
        if (usedFallback || !mlResult) {
            mlResult = {
                label: fallbackDisease,
                confidence: 0.85 + (Math.random() * 0.1), // Mock confidence
                recommendation:
                    fallbackDisease === "healthy"
                        ? "Great news! Your plant looks healthy. Continue with regular care."
                        : `${fallbackDisease.replace("_", " ")} detected. Recommendation: Isolate infected plants and monitor moisture levels.`,
            };
        } else {
            // Normalize PaLiGemma response into the legacy shape expected by the UI
            mlResult = {
                label: mlResult.disease || fallbackDisease,
                confidence: typeof mlResult.confidence === "number" ? mlResult.confidence : 0,
                recommendation:
                    mlResult.recommendation ||
                    (mlResult.diagnosis
                        ? `${mlResult.diagnosis}. Please follow local agronomist guidance for treatment.`
                        : "Model generated a diagnosis but no specific recommendation text was provided."),
                raw: mlResult,
            };
        }

        // 5. Combine Results
        const result = {
            moisture: moisture,
            grade: grade,
            pests: mlResult.label,
            disease_confidence: mlResult.confidence,
            recommendation: mlResult.recommendation,
            ml_data: mlResult,
            is_fallback: usedFallback
        };

        return res.status(200).json(success(result));

    } catch (error) {
        console.error("Scan quality error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

module.exports = {
    getDashboard,
    getMarket,
    getWallet,
    getInventory,
    addProduct,
    createBatch,
    getBatchById,
    advanceBatchDelivery,
    scanQuality,
};
