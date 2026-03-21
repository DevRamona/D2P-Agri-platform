import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createRequire } from "module";
import type { AddressInfo } from "net";

const require = createRequire(import.meta.url);
const mongoose = require("../../backend/node_modules/mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.ALLOW_MOBILE_MONEY_STUB = "true";
process.env.FRONTEND_PUBLIC_URL = "http://localhost:5173";
process.env.BACKEND_PUBLIC_URL = "http://localhost:4000";

const { app } = require("../../backend/src/app");
const { User } = require("../../backend/src/models/User");
const Product = require("../../backend/src/models/Product");
const Batch = require("../../backend/src/models/Batch");
const BuyerOrder = require("../../backend/src/models/BuyerOrder");

type StorageMap = Map<string, string>;

const createLocalStorageMock = () => {
  const storage: StorageMap = new Map();

  return {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
};

describe("Frontend to backend integration", () => {
  let mongoServer: InstanceType<typeof MongoMemoryServer>;
  let server: import("http").Server;
  let baseUrl = "";
  let windowMock: { localStorage: ReturnType<typeof createLocalStorageMock> };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1" },
    });
    await mongoose.connect(mongoServer.getUri());

    server = await new Promise((resolve) => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });

    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    process.env.VITE_API_URL = baseUrl;
    process.env.BACKEND_PUBLIC_URL = baseUrl;
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Batch.deleteMany({}),
      BuyerOrder.deleteMany({}),
    ]);

    windowMock = {
      localStorage: createLocalStorageMock(),
    };

    Object.assign(globalThis, {
      window: windowMock,
      localStorage: windowMock.localStorage,
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test("buyer frontend API can log in, read marketplace data, create an order, and see order history", async () => {
    const authApi = await import("../src/api/auth");
    const buyerApi = await import("../src/api/buyer");
    const authStorage = await import("../src/utils/authStorage");

    await authApi.register({
      fullName: "Farmer Seller",
      phoneNumber: "+250700400001",
      password: "password123",
      role: "farmer",
    });

    await authApi.register({
      fullName: "Buyer Demo",
      phoneNumber: "+250700400002",
      email: "buyer@example.com",
      password: "password123",
      role: "buyer",
    });

    const farmer = await User.findOne({ phoneNumber: "+250700400001" });
    const buyer = await User.findOne({ phoneNumber: "+250700400002" });

    const product = await Product.create({
      farmer: farmer._id,
      name: "Dry Beans",
      quantity: 1200,
      unit: "kg",
      pricePerUnit: 850,
      image: "/uploads/dry-beans.jpg",
    });

    const batch = await Batch.create({
      farmer: farmer._id,
      products: [{ product: product._id, quantity: 1200 }],
      totalWeight: 1200,
      totalPrice: 1020000,
      destination: "Kigali Central Aggregator",
      status: "active",
    });

    const loginResponse = await authApi.login({
      identifier: buyer.phoneNumber,
      password: "password123",
    });

    authStorage.setTokens(loginResponse.accessToken, loginResponse.refreshToken);
    authStorage.setStoredUser(loginResponse.user);

    const marketplace = await buyerApi.getBuyerMarketplace();
    expect(marketplace.total).toBe(1);
    expect(marketplace.batches[0].id).toBe(String(batch._id));

    const createdOrder = await buyerApi.createBuyerOrder({
      batchId: String(batch._id),
      paymentMethod: "momo",
    });
    expect(createdOrder.order.orderNumber).toBeDefined();
    expect(createdOrder.order.title).toContain("Batch");

    const history = await buyerApi.getBuyerOrders();
    expect(history.totals.totalOrders).toBe(1);
    expect(history.orders[0].id).toBe(createdOrder.order.id);
  });

  test("farmer frontend API can log in and receive account identity plus delivery sections from dashboard", async () => {
    const authApi = await import("../src/api/auth");
    const farmerApi = await import("../src/api/farmer");
    const authStorage = await import("../src/utils/authStorage");

    await authApi.register({
      fullName: "Monia Ishimwe",
      phoneNumber: "0788884848",
      email: "monia@example.com",
      password: "password123",
      role: "farmer",
    });

    await authApi.register({
      fullName: "Moana Umuringa",
      phoneNumber: "0780000001",
      email: "moana@example.com",
      password: "password123",
      role: "buyer",
    });

    const farmer = await User.findOne({ phoneNumber: "0788884848" });
    const buyer = await User.findOne({ phoneNumber: "0780000001" });

    const activeProduct = await Product.create({
      farmer: farmer._id,
      name: "Maize",
      quantity: 500,
      unit: "kg",
      pricePerUnit: 650,
      image: "/uploads/maize.jpg",
    });

    const soldProduct = await Product.create({
      farmer: farmer._id,
      name: "Beans",
      quantity: 100,
      unit: "kg",
      pricePerUnit: 44.8,
      image: "/uploads/beans.jpg",
    });

    const inProgressBatch = await Batch.create({
      farmer: farmer._id,
      products: [{ product: activeProduct._id, quantity: 500 }],
      totalWeight: 500,
      totalPrice: 325000,
      destination: "Kigali Central Aggregator",
      status: "active",
    });

    const soldBatch = await Batch.create({
      farmer: farmer._id,
      products: [{ product: soldProduct._id, quantity: 100 }],
      totalWeight: 100,
      totalPrice: 4480,
      destination: "Kigali Central Aggregator",
      status: "sold",
      soldAt: new Date("2026-03-21T09:35:39.096Z"),
    });

    await BuyerOrder.create({
      orderNumber: "AG-572242",
      buyer: buyer._id,
      farmer: farmer._id,
      batch: inProgressBatch._id,
      title: "Maize Batch",
      cropKey: "maize",
      cropNames: ["Maize"],
      image: null,
      destination: "Kigali Central Aggregator",
      farmerName: farmer.fullName,
      buyerName: buyer.fullName,
      totalWeight: 500,
      totalPrice: 325000,
      pricePerKg: 650,
      currency: "RWF",
      depositPercent: 0.6,
      depositAmount: 195000,
      balanceDue: 130000,
      serviceFee: 5000,
      insuranceFee: 0,
      amountDueToday: 200000,
      paymentMethod: "momo",
      paymentStatus: "deposit_paid",
      escrowStatus: "funded",
      status: "active",
      trackingStage: "farmer_dispatching",
      trackingUpdatedAt: new Date("2026-03-21T10:00:00.000Z"),
    });

    const loginResponse = await authApi.login({
      identifier: farmer.phoneNumber,
      password: "password123",
    });

    authStorage.setTokens(loginResponse.accessToken, loginResponse.refreshToken);
    authStorage.setStoredUser(loginResponse.user);

    const dashboard = await farmerApi.getDashboard();
    expect(dashboard.account.id).toBe(String(farmer._id));
    expect(dashboard.account.fullName).toBe("Monia Ishimwe");
    expect(dashboard.totalEarnings).toBe(4480);
    expect(dashboard.inProgressOrders).toHaveLength(1);
    expect(dashboard.inProgressOrders[0].batchId).toBe(String(inProgressBatch._id));
    expect(dashboard.recentlySoldBatches).toHaveLength(1);
    expect(dashboard.recentlySoldBatches[0].batchId).toBe(String(soldBatch._id));
  });
});
