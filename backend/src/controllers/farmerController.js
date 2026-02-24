const { success, failure } = require("../utils/response");
const Product = require("../models/Product");
const Batch = require("../models/Batch");
const { getMarketPayload } = require("../services/marketPriceService");
const crypto = require('crypto');
const fs = require('fs');

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

        // Fetch active batches
        const activeBatches = await Batch.find({ farmer: userId, status: 'active' })
            .populate('products.product', 'name unit image')
            .sort({ createdAt: -1 });

        // Calculate total earnings from sold batches
        const soldBatches = await Batch.find({ farmer: userId, status: 'sold' });
        const totalEarnings = soldBatches.reduce((sum, batch) => sum + batch.totalPrice, 0);

        // Calculate earnings change (mock logic for now, or compare with last month)
        const earningsChange = "+0% vs last month";
        const marketPayload = await getMarketPayload();

        const dashboardData = {
            totalEarnings,
            earningsChange,
            activeBatches,
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

        return res.status(200).json(success(batch));
    } catch (error) {
        console.error("Get batch error:", error);
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

        // 2. Prepare to send to ML Service
        const formData = new FormData();
        const imageBlob = new Blob([fileBuffer], {
            type: req.file.mimetype || 'application/octet-stream',
        });
        formData.append('file', imageBlob, req.file.originalname || 'scan.jpg');

        // 3. Call ML Service
        const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        let mlResult = null;
        let usedFallback = false;

        try {
            const response = await fetch(`${ML_SERVICE_URL}/predict`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                mlResult = await response.json();
            } else {
                console.warn("ML Service returned error:", response.status);
                usedFallback = true;
            }
        } catch (mlError) {
            console.error("Failed to connect to ML Service:", mlError.message);
            usedFallback = true;
        }

        // 4. Apply Fallback if ML failed
        if (usedFallback || !mlResult) {
            mlResult = {
                label: fallbackDisease,
                confidence: 0.85 + (Math.random() * 0.1), // Mock confidence
                recommendation: fallbackDisease === "healthy"
                    ? "Great news! Your plant looks healthy. Continue with regular care."
                    : `${fallbackDisease.replace('_', ' ')} detected. Recommendation: Isolate infected plants and monitor moisture levels.`
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
    scanQuality,
};
