import { apiFetch } from "./client";

export type Product = {
    _id: string;
    name: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    image: string;
    status: string;
    dateAdded: string;
};

export type Batch = {
    _id: string;
    products: { product: string | Product; quantity: number }[];
    totalWeight: number;
    totalPrice: number;
    status: string;
    createdAt: string;
};

export type FarmerMarketPrice = {
    id?: string;
    crop: string;
    cropKey?: string;
    price: string;
    unit: string;
    change: string;
    positive: boolean;
    currency?: string;
    region?: string;
    source?: string;
    asOf?: string;
    numericPrice?: number;
    numericChangePercent?: number;
};

export type DashboardData = {
    totalEarnings: number;
    earningsChange: string | null;
    activeBatches: Batch[];
    marketPrices: FarmerMarketPrice[];
    lastSynced: string;
};

export type FarmerMarketData = {
    marketPrices: FarmerMarketPrice[];
    lastSynced: string;
    source: "database" | "external" | string;
    seededDefaults: boolean;
};

export type WalletActivity = {
    id: string;
    title: string;
    amount: number;
    direction: "credit" | "debit";
    status: "completed" | "processing" | "failed";
    reference: string;
    occurredAt: string;
};

export type WalletData = {
    currency: string;
    availableBalance: number;
    totalEarned: number;
    pendingPayout: number;
    recentActivity: WalletActivity[];
    lastSynced: string;
};

export const getDashboard = () =>
    apiFetch<DashboardData>("/farmer/dashboard");

export const getWallet = () =>
    apiFetch<WalletData>("/farmer/wallet");

export const getMarket = () =>
    apiFetch<FarmerMarketData>("/farmer/market");

export const getInventory = () =>
    apiFetch<Product[]>("/farmer/inventory");

export const addProduct = (data: Partial<Product> & { imageFile?: File }) => {
    if (data.imageFile) {
        const formData = new FormData();
        formData.append("name", data.name || "");
        formData.append("quantity", String(data.quantity || 0));
        formData.append("unit", data.unit || "kg");
        formData.append("pricePerUnit", String(data.pricePerUnit || 0));
        formData.append("image", data.imageFile);

        return apiFetch<Product>("/farmer/inventory", {
            method: "POST",
            body: formData,
        });
    }

    return apiFetch<Product>("/farmer/inventory", {
        method: "POST",
        body: JSON.stringify(data),
    });
};

export const createBatch = (data: Partial<Batch>) =>
    apiFetch<Batch>("/farmer/batch", {
        method: "POST",
        body: JSON.stringify(data),
    });

export const getBatchById = (id: string) =>
    apiFetch<Batch>(`/farmer/batch/${id}`);
