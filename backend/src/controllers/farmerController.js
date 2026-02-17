

const { success, failure } = require("../utils/response");
const Product = require("../models/Product");
const Batch = require("../models/Batch");

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
        // For simplicity, we'll keep the static string or implement basic logic later
        const earningsChange = "+0% vs last month";

        // Mock market prices (could be fetched from an external API or another collection)
        const marketPrices = [
            { crop: "Arabica Coffee", price: "2,400", unit: "/kg", change: "+2.4%", positive: true },
            { crop: "Maize", price: "650", unit: "/kg", change: "-0.8%", positive: false },
            { crop: "Dry Beans", price: "900", unit: "/kg", change: "+1.1%", positive: true },
        ];

        const dashboardData = {
            totalEarnings,
            earningsChange,
            activeBatches,
            marketPrices,
            lastSynced: new Date().toISOString(),
        };

        return res.status(200).json(success(dashboardData));
    } catch (error) {
        console.error("Dashboard error:", error);
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
            // Construct full URL or relative path
            // For now, let's store the relative path which the frontend can prefix
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

        // Check if the batch belongs to the authenticated farmer
        if (batch.farmer.toString() !== req.user.id) {
            return res.status(403).json(failure("FORBIDDEN", "You do not have permission to view this batch"));
        }

        return res.status(200).json(success(batch));
    } catch (error) {
        console.error("Get batch error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

module.exports = {
    getDashboard,
    getInventory,
    addProduct,
    createBatch,
    getBatchById,
};
