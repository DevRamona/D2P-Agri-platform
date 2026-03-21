process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.ALLOW_MOBILE_MONEY_STUB = "true";
process.env.FRONTEND_PUBLIC_URL = "http://localhost:5173";
process.env.BACKEND_PUBLIC_URL = "http://localhost:4000";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/app");
const { User } = require("../src/models/User");
const Product = require("../src/models/Product");
const Batch = require("../src/models/Batch");
const BuyerOrder = require("../src/models/BuyerOrder");
const { signAccessToken } = require("../src/utils/token");

jest.setTimeout(20_000);

describe("Buyer Routes - Clean Tests", () => {
  let mongoServer;
  let farmer;
  let buyer;
  let buyerToken;

  const authHeader = { };

  const seedMarketplaceBatch = async () => {
    const product = await Product.create({
      farmer: farmer._id,
      name: "Dry Beans",
      quantity: 1200,
      unit: "kg",
      pricePerUnit: 850,
      image: "/uploads/dry-beans.jpg",
    });

    return Batch.create({
      farmer: farmer._id,
      products: [{ product: product._id, quantity: 1200 }],
      totalWeight: 1200,
      totalPrice: 1020000,
      destination: "Kigali Central Aggregator",
      status: "active",
    });
  };

  const createOrderForBatch = async (batchId, paymentMethod = "card") =>
    request(app)
      .post("/buyer/orders")
      .set({ Authorization: `Bearer ${buyerToken}` })
      .send({
        batchId: String(batchId),
        paymentMethod,
      });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1" },
    });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Batch.deleteMany({}),
      BuyerOrder.deleteMany({}),
    ]);

    farmer = await User.create({
      fullName: "Farmer Seller",
      phoneNumber: "+250700200001",
      passwordHash: "hash",
      role: "FARMER",
    });

    buyer = await User.create({
      fullName: "Buyer Demo",
      phoneNumber: "+250700200002",
      email: "buyer@example.com",
      passwordHash: "hash",
      role: "BUYER",
    });

    buyerToken = signAccessToken({ id: String(buyer._id), role: "BUYER" });
    authHeader.Authorization = `Bearer ${buyerToken}`;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.FLUTTERWAVE_SECRET_KEY;
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    process.env.ALLOW_MOBILE_MONEY_STUB = "true";
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe("GET /buyer/marketplace", () => {
    test("should return active marketplace batches", async () => {
      await seedMarketplaceBatch();

      const res = await request(app)
        .get("/buyer/marketplace")
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.batches)).toBe(true);
      expect(res.body.data.batches[0].title).toContain("Batch");
    });

    test("should return 401 when token is missing", async () => {
      const res = await request(app).get("/buyer/marketplace");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /buyer/orders", () => {
    test("should create an order from an active batch", async () => {
      const batch = await seedMarketplaceBatch();

      const res = await createOrderForBatch(batch._id);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order.orderNumber).toBeDefined();
      expect(Array.isArray(res.body.data.timeline)).toBe(true);
    });

    test("should return 404 when the batch does not exist", async () => {
      const res = await createOrderForBatch(new mongoose.Types.ObjectId());

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    test("should block duplicate active orders for the same batch", async () => {
      const batch = await seedMarketplaceBatch();

      const first = await createOrderForBatch(batch._id);
      const second = await createOrderForBatch(batch._id);

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe("BATCH_ALREADY_ORDERED");

      const orders = await BuyerOrder.find({ batch: batch._id }).lean();
      expect(orders).toHaveLength(1);
    });
  });

  describe("GET /buyer/orders", () => {
    test("should return buyer order history", async () => {
      const batch = await seedMarketplaceBatch();
      await createOrderForBatch(batch._id);

      const res = await request(app)
        .get("/buyer/orders")
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
      expect(res.body.data.totals.totalOrders).toBe(1);
    });
  });

  describe("GET /buyer/orders/:id", () => {
    test("should return a buyer order by id", async () => {
      const batch = await seedMarketplaceBatch();
      const created = await createOrderForBatch(batch._id);
      const orderId = created.body.data.order.id;

      const res = await request(app)
        .get(`/buyer/orders/${orderId}`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.order.id).toBe(orderId);
    });

    test("should return 404 for an unknown order", async () => {
      const res = await request(app)
        .get(`/buyer/orders/${new mongoose.Types.ObjectId()}`)
        .set(authHeader);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /buyer/profile", () => {
    test("should return buyer profile summary", async () => {
      const res = await request(app)
        .get("/buyer/profile")
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.buyer.fullName).toBe("Buyer Demo");
      expect(res.body.data.summary.totalOrders).toBe(0);
    });
  });

  describe("POST /buyer/orders/:id/checkout-session", () => {
    test("should create a Flutterwave mobile money checkout when configured", async () => {
      process.env.FLUTTERWAVE_SECRET_KEY = "flw_secret_test";
      process.env.FLUTTERWAVE_SECRET_HASH = "flw_hash_test";
      process.env.ALLOW_MOBILE_MONEY_STUB = "false";

      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            status: "success",
            message: "Charge initiated",
            meta: {
              authorization: {
                mode: "redirect",
                redirect: "https://checkout.flutterwave.com/mock/mobile-money",
              },
            },
            data: {
              id: 987654,
              tx_ref: "fw_checkout_ref_123",
              flw_ref: "FLW-MOCK-123",
              status: "pending",
            },
          }),
      });

      const batch = await seedMarketplaceBatch();
      const created = await createOrderForBatch(batch._id, "momo");
      const orderId = created.body.data.order.id;

      const res = await request(app)
        .post(`/buyer/orders/${orderId}/checkout-session`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.checkout.kind).toBe("mobile_money");
      expect(res.body.data.checkout.method).toBe("momo");
      expect(res.body.data.checkout.url).toBe("https://checkout.flutterwave.com/mock/mobile-money");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, requestInit] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.flutterwave.com/v3/charges?type=mobile_money_rwanda");
      expect(JSON.parse(requestInit.body).network).toBe("MTN");

      const savedOrder = await BuyerOrder.findById(orderId).lean();
      expect(savedOrder.mobileMoneyProvider).toBe("mtn");
      expect(savedOrder.mobileMoneyExternalId).toBe("987654");
      expect(savedOrder.paymentStatus).toBe("pending");
      expect(savedOrder.escrowStatus).toBe("awaiting_payment");
    });

    test("should create mobile money checkout instructions in stub mode", async () => {
      const batch = await seedMarketplaceBatch();
      const created = await createOrderForBatch(batch._id, "momo");
      const orderId = created.body.data.order.id;

      const res = await request(app)
        .post(`/buyer/orders/${orderId}/checkout-session`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.checkout.kind).toBe("mobile_money");
      expect(res.body.data.checkout.method).toBe("momo");
      expect(Array.isArray(res.body.data.checkout.instructions)).toBe(true);
    });
  });
});
