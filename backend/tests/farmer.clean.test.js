process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/app");
const { User } = require("../src/models/User");
const Product = require("../src/models/Product");
const Batch = require("../src/models/Batch");
const BuyerOrder = require("../src/models/BuyerOrder");
const MarketPrice = require("../src/models/MarketPrice");
const { signAccessToken } = require("../src/utils/token");

jest.setTimeout(20_000);

describe("Farmer Routes - Clean Tests", () => {
  let mongoServer;
  let farmer;
  let otherFarmer;
  let farmerToken;

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  const seedProduct = async (overrides = {}) =>
    Product.create({
      farmer: farmer._id,
      name: "Maize",
      quantity: 500,
      unit: "kg",
      pricePerUnit: 650,
      ...overrides,
    });

  const seedBatch = async (overrides = {}) => {
    const product = await seedProduct();
    return Batch.create({
      farmer: farmer._id,
      products: [{ product: product._id, quantity: 500 }],
      totalWeight: 500,
      totalPrice: 325000,
      destination: "Kigali Central Aggregator",
      status: "active",
      ...overrides,
    });
  };

  const seedBuyer = async () =>
    User.create({
      fullName: "Buyer One",
      phoneNumber: "+250700100003",
      email: "buyer.one@example.com",
      passwordHash: "hash",
      role: "BUYER",
    });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1" },
    });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Batch.deleteMany({}),
      BuyerOrder.deleteMany({}),
      MarketPrice.deleteMany({}),
    ]);

    farmer = await User.create({
      fullName: "Farmer One",
      phoneNumber: "+250700100001",
      passwordHash: "hash",
      role: "FARMER",
    });

    otherFarmer = await User.create({
      fullName: "Farmer Two",
      phoneNumber: "+250700100002",
      passwordHash: "hash",
      role: "FARMER",
    });

    farmerToken = signAccessToken({ id: String(farmer._id), role: "FARMER" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("GET /farmer/dashboard", () => {
    test("should return dashboard data for an authenticated farmer", async () => {
      await seedBatch();

      const res = await request(app)
        .get("/farmer/dashboard")
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.activeBatches)).toBe(true);
      expect(res.body.data.account.fullName).toBe("Farmer One");
      expect(Array.isArray(res.body.data.marketPrices)).toBe(true);
    });

    test("should include account identity, in-progress orders, and recently sold batches", async () => {
      const buyer = await seedBuyer();
      const soldBatch = await seedBatch({ status: "sold", soldAt: new Date("2026-03-21T09:35:39.096Z"), totalPrice: 4480 });
      const activeDeliveryBatch = await seedBatch({ totalPrice: 325000 });

      await BuyerOrder.create({
        orderNumber: "AG-111222",
        buyer: buyer._id,
        farmer: farmer._id,
        batch: activeDeliveryBatch._id,
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

      const res = await request(app)
        .get("/farmer/dashboard")
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.account.id).toBe(String(farmer._id));
      expect(res.body.data.account.phoneNumber).toBe("+250700100001");
      expect(res.body.data.totalEarnings).toBe(4480);
      expect(res.body.data.inProgressOrders).toHaveLength(1);
      expect(res.body.data.inProgressOrders[0].batchId).toBe(String(activeDeliveryBatch._id));
      expect(res.body.data.inProgressOrders[0].trackingStage).toBe("farmer_dispatching");
      expect(res.body.data.recentlySoldBatches).toHaveLength(1);
      expect(res.body.data.recentlySoldBatches[0].batchId).toBe(String(soldBatch._id));
    });

    test("should return 401 when token is missing", async () => {
      const res = await request(app).get("/farmer/dashboard");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /farmer/market", () => {
    test("should return market prices for the farmer", async () => {
      await MarketPrice.create({
        cropKey: "maize",
        crop: "Maize",
        price: 650,
        previousPrice: 620,
        unit: "/kg",
        currency: "RWF",
        region: "Rwanda",
        source: "manual-test",
        isActive: true,
      });

      const res = await request(app)
        .get("/farmer/market")
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.marketPrices)).toBe(true);
      expect(res.body.data.marketPrices.length).toBeGreaterThan(0);
    });
  });

  describe("GET /farmer/wallet", () => {
    test("should return wallet summary and activity", async () => {
      await seedBatch({ status: "sold", soldAt: new Date() });
      await seedBatch({ status: "active" });

      const res = await request(app)
        .get("/farmer/wallet")
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(res.body.data.currency).toBe("RWF");
      expect(Array.isArray(res.body.data.recentActivity)).toBe(true);
    });
  });

  describe("GET /farmer/inventory", () => {
    test("should return farmer inventory items", async () => {
      await seedProduct();

      const res = await request(app)
        .get("/farmer/inventory")
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].name).toBe("Maize");
    });
  });

  describe("POST /farmer/inventory", () => {
    test("should create a farmer product successfully", async () => {
      const res = await request(app)
        .post("/farmer/inventory")
        .set(authHeader(farmerToken))
        .field("name", "Beans")
        .field("quantity", "120")
        .field("unit", "kg")
        .field("pricePerUnit", "900");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Beans");
    });
  });

  describe("POST /farmer/batch", () => {
    test("should create a batch successfully", async () => {
      const product = await seedProduct({ name: "Coffee", quantity: 200, pricePerUnit: 2400 });

      const res = await request(app)
        .post("/farmer/batch")
        .set(authHeader(farmerToken))
        .send({
          products: [{ product: String(product._id), quantity: 200 }],
          totalWeight: 200,
          totalPrice: 480000,
          destination: "Musanze Hub",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.destination).toBe("Musanze Hub");
    });
  });

  describe("GET /farmer/batch/:id", () => {
    test("should return the farmer batch details", async () => {
      const batch = await seedBatch();

      const res = await request(app)
        .get(`/farmer/batch/${batch._id}`)
        .set(authHeader(farmerToken));

      expect(res.status).toBe(200);
      expect(String(res.body.data._id)).toBe(String(batch._id));
    });

    test("should return 403 for a batch owned by another farmer", async () => {
      const batch = await Batch.create({
        farmer: otherFarmer._id,
        products: [],
        totalWeight: 100,
        totalPrice: 100000,
        destination: "Kayonza Hub",
        status: "active",
      });

      const res = await request(app)
        .get(`/farmer/batch/${batch._id}`)
        .set(authHeader(farmerToken));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
