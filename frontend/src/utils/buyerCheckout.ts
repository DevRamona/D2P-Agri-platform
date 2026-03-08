import type { BuyerMarketplaceBatch, BuyerMarketplaceProduct, BuyerOrder } from "../api/buyer";

const BUYER_SELECTED_BATCH_KEY = "d2p_buyer_selected_batch";
const BUYER_SELECTED_ORDER_KEY = "d2p_buyer_selected_order";

export const ORDER_DEPOSIT_PERCENT = 0.6;

export type BuyerSelectedBatch = {
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

export type BuyerOrderQuote = {
  depositPercent: number;
  depositAmount: number;
  balanceDue: number;
  serviceFee: number;
  insuranceFee: number;
  amountDueToday: number;
};

const canUseStorage = () => typeof window !== "undefined" && !!window.sessionStorage;

export const setBuyerSelectedBatch = (batch: BuyerMarketplaceBatch) => {
  if (!canUseStorage()) return;

  const payload: BuyerSelectedBatch = {
    id: batch.id,
    title: batch.title,
    cropKey: batch.cropKey,
    cropNames: batch.cropNames || [],
    farmerName: batch.farmerName,
    destination: batch.destination,
    status: batch.status,
    tag: batch.tag,
    image: batch.image,
    totalWeight: Number(batch.totalWeight) || 0,
    totalPrice: Number(batch.totalPrice) || 0,
    pricePerKg: Number(batch.pricePerKg) || 0,
    createdAt: batch.createdAt,
    productCount: Number(batch.productCount) || 0,
    products: Array.isArray(batch.products) ? batch.products : [],
    aiScore: batch.aiScore ?? null,
  };

  window.sessionStorage.setItem(BUYER_SELECTED_BATCH_KEY, JSON.stringify(payload));
};

export const getBuyerSelectedBatch = (): BuyerSelectedBatch | null => {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(BUYER_SELECTED_BATCH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as BuyerSelectedBatch;
  } catch {
    return null;
  }
};

export const clearBuyerSelectedBatch = () => {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(BUYER_SELECTED_BATCH_KEY);
};

export type BuyerSelectedOrder = BuyerOrder;

export const setBuyerSelectedOrder = (order: BuyerOrder) => {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(BUYER_SELECTED_ORDER_KEY, JSON.stringify(order));
};

export const getBuyerSelectedOrder = (): BuyerSelectedOrder | null => {
  if (!canUseStorage()) return null;
  const raw = window.sessionStorage.getItem(BUYER_SELECTED_ORDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BuyerSelectedOrder;
  } catch {
    return null;
  }
};

export const clearBuyerSelectedOrder = () => {
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(BUYER_SELECTED_ORDER_KEY);
};

export const getBuyerOrderQuote = (
  batch: BuyerSelectedBatch | null,
  options?: { depositPercent?: number; serviceFeeRate?: number; serviceFeeMinimum?: number; insuranceFee?: number },
): BuyerOrderQuote => {
  const totalPrice = Number(batch?.totalPrice) || 0;
  const depositPercent = options?.depositPercent ?? ORDER_DEPOSIT_PERCENT;
  const serviceFeeRate = options?.serviceFeeRate ?? 0.01;
  const serviceFeeMinimum = options?.serviceFeeMinimum ?? 5000;
  const insuranceFee = options?.insuranceFee ?? 0;

  const depositAmount = Math.round(totalPrice * depositPercent);
  const balanceDue = Math.max(0, totalPrice - depositAmount);
  const serviceFee = totalPrice > 0 ? Math.max(serviceFeeMinimum, Math.round(totalPrice * serviceFeeRate)) : 0;
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

export const formatOrderReference = (batchId: string | null | undefined) => {
  if (!batchId) return "AG-ORDER";
  return `AG-${String(batchId).slice(-6).toUpperCase()}`;
};
