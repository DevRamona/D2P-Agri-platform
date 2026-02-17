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

export type DashboardData = {
    totalEarnings: number;
    earningsChange: string | null;
    activeBatches: Batch[];
    marketPrices: {
        crop: string;
        price: string;
        unit: string;
        change: string;
        positive: boolean;
    }[];
    lastSynced: string;
};

export const getDashboard = () =>
    apiFetch<{ data: DashboardData }>("/farmer/dashboard");

export const getInventory = () =>
    apiFetch<{ data: Product[] }>("/farmer/inventory");

export const addProduct = (data: Partial<Product> & { imageFile?: File }) => {
    if (data.imageFile) {
        const formData = new FormData();
        formData.append("name", data.name || "");
        formData.append("quantity", String(data.quantity || 0));
        formData.append("unit", data.unit || "kg");
        formData.append("pricePerUnit", String(data.pricePerUnit || 0));
        formData.append("image", data.imageFile);

        return apiFetch<{ data: Product }>("/farmer/inventory", {
            method: "POST",
            body: formData,
        });
    }

    return apiFetch<{ data: Product }>("/farmer/inventory", {
        method: "POST",
        body: JSON.stringify(data),
    });
};

export const createBatch = (data: Partial<Batch>) =>
    apiFetch<{ data: Batch }>("/farmer/batch", {
        method: "POST",
        body: JSON.stringify(data),
    });
