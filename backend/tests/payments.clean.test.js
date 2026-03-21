process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.FLUTTERWAVE_SECRET_KEY = "flw_secret_test";
process.env.FLUTTERWAVE_SECRET_HASH = "flw_hash_test";
process.env.FRONTEND_PUBLIC_URL = "http://localhost:5173";
process.env.BACKEND_PUBLIC_URL = "http://localhost:4000";

const crypto = require("crypto");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../src/app");
const { User } = require("../src/models/User");
const BuyerOrder = require("../src/models/BuyerOrder");

jest.setTimeout(20_000);

describe("Payment Routes - Clean Tests", () => {
  let mongoServer;
  let buyer;
  let farmer;
  let order;

  const seedPendingMobileMoneyOrder = async () =>
    BuyerOrder.create({
      orderNumber: "AG-554433",
      buyer: buyer._id,
      farmer: farmer._id,
      batch: new mongoose.Types.ObjectId(),
      title: "Beans Batch",
      cropKey: "beans",
      cropNames: ["Beans"],
      image: null,
      destination: "Kigali Central Aggregator",
      farmerName: farmer.fullName,
      buyerName: buyer.fullName,
      totalWeight: 1200,
      totalPrice: 1020000,
      pricePerKg: 850,
      currency: "RWF",
      depositPercent: 0.6,
      depositAmount: 612000,
      balanceDue: 408000,
      serviceFee: 10200,
      insuranceFee: 0,
      amountDueToday: 622200,
      paymentMethod: "momo",
      paymentStatus: "pending",
      escrowStatus: "awaiting_payment",
      trackingStage: "awaiting_payment",
      stripeTransferGroup: "buyer_order_AG-554433",
      mobileMoneyProvider: "mtn",
      mobileMoneyProviderCode: "mtn_momo",
      mobileMoneyReference: "fw_checkout_ref_123",
      trackingUpdatedAt: new Date(),
    });

  const mockFlutterwaveVerification = (paymentOrder) =>
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: "success",
          message: "Transaction fetched successfully",
          data: {
            id: 998877,
            tx_ref: paymentOrder.mobileMoneyReference,
            flw_ref: "FLW-MOCK-VERIFY-123",
            amount: paymentOrder.amountDueToday,
            currency: "RWF",
            status: "successful",
            network: "MTN",
            meta: {
              orderId: String(paymentOrder._id),
              paymentMethod: "momo",
            },
            customer: {
              phone_number: buyer.phoneNumber,
            },
          },
        }),
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
      BuyerOrder.deleteMany({}),
    ]);

    farmer = await User.create({
      fullName: "Farmer Seller",
      phoneNumber: "+250700300001",
      passwordHash: "hash",
      role: "FARMER",
    });

    buyer = await User.create({
      fullName: "Buyer Demo",
      phoneNumber: "+250700300002",
      email: "buyer@example.com",
      passwordHash: "hash",
      role: "BUYER",
    });

    order = await seedPendingMobileMoneyOrder();
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

  describe("POST /payments/flutterwave/webhook", () => {
    test("should verify the transaction and mark the order as funded", async () => {
      const fetchMock = mockFlutterwaveVerification(order);
      const rawPayload = JSON.stringify({
        data: {
          id: 998877,
          tx_ref: order.mobileMoneyReference,
          status: "successful",
          meta: {
            orderId: String(order._id),
            paymentMethod: "momo",
          },
        },
      });
      const signature = crypto
        .createHmac("sha256", process.env.FLUTTERWAVE_SECRET_HASH)
        .update(rawPayload)
        .digest("hex");

      const res = await request(app)
        .post("/payments/flutterwave/webhook")
        .set("Content-Type", "application/json")
        .set("flutterwave-signature", signature)
        .send(rawPayload);

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.flutterwave.com/v3/transactions/998877/verify",
        expect.objectContaining({
          method: "GET",
        }),
      );

      const updatedOrder = await BuyerOrder.findById(order._id).lean();
      expect(updatedOrder.paymentStatus).toBe("deposit_paid");
      expect(updatedOrder.escrowStatus).toBe("funded");
      expect(updatedOrder.trackingStage).toBe("payment_confirmed");
      expect(updatedOrder.mobileMoneyExternalId).toBe("998877");
      expect(updatedOrder.mobileMoneyTransactionId).toBe("FLW-MOCK-VERIFY-123");
    });
  });

  describe("GET /payments/flutterwave/callback", () => {
    test("should verify the transaction and redirect back to buyer tracking", async () => {
      mockFlutterwaveVerification(order);

      const res = await request(app)
        .get(
          `/payments/flutterwave/callback?orderId=${order._id}&provider=momo&transaction_id=998877&tx_ref=${order.mobileMoneyReference}&status=successful`,
        )
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(`/buyer/order-tracking?orderId=${order._id}`);
      expect(res.headers.location).toContain("checkout=mobile_money");
      expect(res.headers.location).toContain("provider=momo");
      expect(res.headers.location).toContain("status=successful");

      const updatedOrder = await BuyerOrder.findById(order._id).lean();
      expect(updatedOrder.paymentStatus).toBe("deposit_paid");
      expect(updatedOrder.escrowStatus).toBe("funded");
    });
  });
});
