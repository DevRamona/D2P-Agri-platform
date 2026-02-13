import { apiFetch } from "./client";

export type DashboardData = {
    totalEarnings: number;
    earningsChange: string | null;
    activeBatches: any[]; // Define stronger type later
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
