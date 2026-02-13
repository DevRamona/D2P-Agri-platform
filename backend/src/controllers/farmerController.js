const { success, failure } = require("../utils/response");

const getDashboard = async (req, res) => {
    try {
        // In a real app, you would fetch these from the database based on req.user.id
        // For now, we return empty/default values as requested to remove hardcoded frontend data.

        // innovative: return real-time market prices if possible, otherwise static
        const marketPrices = [
            { crop: "Arabica Coffee", price: "2,400", unit: "/kg", change: "+2.4%", positive: true },
            { crop: "Maize", price: "650", unit: "/kg", change: "-0.8%", positive: false },
            { crop: "Dry Beans", price: "900", unit: "/kg", change: "+1.1%", positive: true },
        ];

        const dashboardData = {
            totalEarnings: 0,
            earningsChange: "+0% vs last month",
            activeBatches: [], // No batches yet for new user
            marketPrices,
            lastSynced: new Date().toISOString(),
        };

        return res.status(200).json(success(dashboardData));
    } catch (error) {
        console.error("Dashboard error:", error);
        return res.status(500).json(failure("INTERNAL_ERROR", "Internal server error"));
    }
};

module.exports = {
    getDashboard,
};
