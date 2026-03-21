process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { User } = require("../src/models/User");
const Batch = require("../src/models/Batch");
const BuyerOrder = require("../src/models/BuyerOrder");
const { cleanupDuplicateBatchOrders } = require("../src/scripts/cleanupDuplicateBatchOrders");

jest.setTimeout(20_000);

describe("Duplicate batch order cleanup integration", () => {
  let mongoServer;
  let farmer;
  let buyer;

  const createBatch = async (overrides = {}) =>
    Batch.create({
      farmer: farmer._id,
      products: [],
      totalWeight: 100,
      totalPrice: 4480,
      destination: "Kigali Central Aggregator",
      status: "sold",
      soldAt: new Date("2026-03-21T09:35:39.096Z"),
      ...overrides,
    });

  const createOrder = async (batchId, overrides = {}) =>
    BuyerOrder.create({
      orderNumber: `AG-${Math.floor(100000 + Math.random() * 900000)}`,
      buyer: buyer._id,
      farmer: farmer._id,
      batch: batchId,
      title: "Beans Batch",
      cropKey: "beans",
      cropNames: ["Beans"],
      image: null,
      destination: "Kigali Central Aggregator",
      farmerName: farmer.fullName,
      buyerName: buyer.fullName,
      totalWeight: 100,
      totalPrice: 4480,
      pricePerKg: 45,
      currency: "RWF",
      depositPercent: 0.6,
      depositAmount: 2688,
      balanceDue: 1792,
      serviceFee: 5000,
      insuranceFee: 0,
      amountDueToday: 7688,
      paymentMethod: "momo",
      paymentStatus: "pending",
      escrowStatus: "awaiting_payment",
      status: "active",
      trackingStage: "awaiting_payment",
      trackingUpdatedAt: new Date("2026-03-21T09:00:00.000Z"),
      ...overrides,
    });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1" },
    });
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Batch.deleteMany({}), BuyerOrder.deleteMany({})]);

    farmer = await User.create({
      fullName: "Monia Ishimwe",
      phoneNumber: "0788884848",
      passwordHash: "hash",
      role: "FARMER",
    });

    buyer = await User.create({
      fullName: "Moana Umuringa",
      phoneNumber: "0780000001",
      email: "moana@example.com",
      passwordHash: "hash",
      role: "BUYER",
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test("should keep the completed released order and cancel stale duplicates", async () => {
    const batch = await createBatch();
    const completed = await createOrder(batch._id, {
      orderNumber: "AG-572242",
      status: "completed",
      paymentStatus: "deposit_paid",
      escrowStatus: "released",
      trackingStage: "delivered",
      completedAt: new Date("2026-03-21T09:35:39.096Z"),
      escrowReleasedAt: new Date("2026-03-21T09:35:39.096Z"),
    });
    await createOrder(batch._id, {
      orderNumber: "AG-721715",
      paymentStatus: "deposit_paid",
      escrowStatus: "funded",
      trackingStage: "payment_confirmed",
    });
    await createOrder(batch._id, {
      orderNumber: "AG-508491",
      paymentStatus: "deposit_paid",
      escrowStatus: "funded",
      trackingStage: "payment_confirmed",
    });

    const summary = await cleanupDuplicateBatchOrders();
    const orders = await BuyerOrder.find({ batch: batch._id }).sort({ orderNumber: 1 }).lean();
    const refreshedBatch = await Batch.findById(batch._id).lean();

    expect(summary.duplicateGroups).toBe(1);
    expect(summary.cancelledOrders).toHaveLength(2);
    expect(summary.keptOrders[0].orderNumber).toBe("AG-572242");

    const cancelledOrders = orders.filter((order) => order.status === "cancelled");
    expect(cancelledOrders).toHaveLength(2);
    expect(cancelledOrders.every((order) => order.paymentStatus === "refunded")).toBe(true);
    expect(cancelledOrders.every((order) => order.escrowStatus === "refunded")).toBe(true);

    const kept = orders.find((order) => String(order._id) === String(completed._id));
    expect(kept.status).toBe("completed");
    expect(kept.escrowStatus).toBe("released");
    expect(refreshedBatch.status).toBe("sold");
    expect(new Date(refreshedBatch.soldAt).toISOString()).toBe("2026-03-21T09:35:39.096Z");
  });
});
