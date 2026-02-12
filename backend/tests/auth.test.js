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
const { RefreshToken } = require("../src/models/RefreshToken");

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

test("register creates user", async () => {
  const res = await request(app)
    .post("/auth/register")
    .send({
      fullName: "Test Farmer",
      phoneNumber: "+250700000001",
      password: "password123",
      role: "FARMER",
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.user.phoneNumber).toBe("+250700000001");
});

test("login returns tokens", async () => {
  await request(app).post("/auth/register").send({
    fullName: "Buyer",
    phoneNumber: "+250700000002",
    password: "password123",
    role: "BUYER",
  });

  const res = await request(app).post("/auth/login").send({
    phoneNumber: "+250700000002",
    password: "password123",
  });

  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toBeDefined();
  expect(res.body.data.refreshToken).toBeDefined();
});

test("me returns current user", async () => {
  await request(app).post("/auth/register").send({
    fullName: "Buyer",
    phoneNumber: "+250700000003",
    password: "password123",
    role: "BUYER",
  });

  const login = await request(app).post("/auth/login").send({
    phoneNumber: "+250700000003",
    password: "password123",
  });

  const res = await request(app)
    .get("/auth/me")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`);

  expect(res.status).toBe(200);
  expect(res.body.data.user.phoneNumber).toBe("+250700000003");
});
