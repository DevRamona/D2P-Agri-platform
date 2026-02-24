import { apiFetch } from "./client";

export type BuyerMarketplaceCategory = {
  key: string;
  label: string;
  count: number;
};

export type BuyerMarketplaceProduct = {
  quantity: number;
  product: {
    id: string;
    name: string;
    unit: string;
    image: string | null;
  };
};

export type BuyerMarketplaceBatch = {
  id: string;
  title: string;
  cropKey: string;
  cropNames: string[];
  farmerName: string;
  destination: string;
  status: string;
  tag: string;
  image: string | null;
  totalWeight: number;
  totalPrice: number;
  pricePerKg: number;
  createdAt: string;
  productCount: number;
  products: BuyerMarketplaceProduct[];
  aiScore: number | null;
};

export type BuyerMarketplaceData = {
  total: number;
  allCount: number;
  filters: {
    crop: string;
    q: string;
  };
  categories: BuyerMarketplaceCategory[];
  batches: BuyerMarketplaceBatch[];
  lastSynced: string;
};

export const getBuyerMarketplace = (params?: { q?: string; crop?: string }) => {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.crop && params.crop !== "all") search.set("crop", params.crop);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<BuyerMarketplaceData>(`/buyer/marketplace${suffix}`);
};

export type BuyerOrder = {
  id: string;
  orderNumber: string;
  title: string;
  cropKey: string;
  cropNames: string[];
  farmerName: string;
  destination: string;
  status: "active" | "completed" | "cancelled" | string;
  paymentStatus: string;
  trackingStage: string;
  image: string | null;
  totalWeight: number;
  totalPrice: number;
  pricePerKg: number;
  currency: string;
  depositPercent: number;
  depositAmount: number;
  balanceDue: number;
  serviceFee: number;
  insuranceFee: number;
  amountDueToday: number;
  paymentMethod: string;
  escrowStatus: "awaiting_payment" | "funded" | "released" | "refunded" | "release_failed" | string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  stripePaymentStatus: string | null;
  estimatedArrivalAt: string | null;
  trackingUpdatedAt: string | null;
  paymentConfirmedAt: string | null;
  escrowFundedAt: string | null;
  escrowReleasedAt: string | null;
  deliveryConfirmedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BuyerOrderTimelineStep = {
  key: string;
  title: string;
  detail: string;
  time: string;
  status: "done" | "active" | "pending" | string;
  updatedAt: string;
};

export type BuyerOrderDetailResponse = {
  order: BuyerOrder;
  timeline: BuyerOrderTimelineStep[];
};

export type BuyerOrderCheckoutSessionData = {
  order: BuyerOrder;
  checkout: {
    sessionId: string;
    url: string | null;
    expiresAt: string | null;
    currency: string;
    transferGroup: string;
  };
};

export type BuyerOrderHistoryData = {
  totals: {
    totalSpent: number;
    totalVolume: number;
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    cancelledOrders: number;
  };
  filters: {
    status: string;
  };
  orders: BuyerOrder[];
  lastSynced: string;
};

export type BuyerProfileData = {
  buyer: {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    role: string;
    createdAt: string | null;
  };
  summary: {
    totalSpent: number;
    totalVolume: number;
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    averageOrderValue: number;
  };
  recentOrders: BuyerOrder[];
  lastSynced: string;
};

export const createBuyerOrder = (payload: { batchId: string; paymentMethod?: "momo" | "airtel" | "bank" }) =>
  apiFetch<BuyerOrderDetailResponse>("/buyer/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createBuyerOrderCheckoutSession = (orderId: string) =>
  apiFetch<BuyerOrderCheckoutSessionData>(`/buyer/orders/${orderId}/checkout-session`, {
    method: "POST",
  });

export const getBuyerOrders = (params?: { status?: string }) => {
  const search = new URLSearchParams();
  if (params?.status && params.status !== "all") search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<BuyerOrderHistoryData>(`/buyer/orders${suffix}`);
};

export const getBuyerOrderById = (orderId: string) =>
  apiFetch<BuyerOrderDetailResponse>(`/buyer/orders/${orderId}`);

export const releaseBuyerOrderEscrow = (orderId: string) =>
  apiFetch<BuyerOrderDetailResponse>(`/buyer/orders/${orderId}/release-escrow`, {
    method: "POST",
  });

export const getBuyerProfile = () =>
  apiFetch<BuyerProfileData>("/buyer/profile");
