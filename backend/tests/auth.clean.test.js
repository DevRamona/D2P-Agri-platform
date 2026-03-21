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

jest.setTimeout(20_000);

describe("Auth Routes - Clean Tests", () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1" },
    });
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    await User.deleteMany({});
    await RefreshToken.deleteMany({});
    jest.restoreAllMocks();
  });

  const registerPayload = (overrides = {}) => ({
    fullName: "Test User",
    phoneNumber: "+250700000001",
    password: "password123",
    role: "BUYER",
    ...overrides,
  });

  const registerAndLogin = async (phoneNumber) => {
    await request(app).post("/auth/register").send(
      registerPayload({
        fullName: "Buyer User",
        phoneNumber,
      }),
    );

    return request(app).post("/auth/login").send({
      identifier: phoneNumber,
      password: "password123",
    });
  };

  describe("POST /auth/register", () => {
    test("should register a new user successfully", async () => {
      const res = await request(app).post("/auth/register").send(registerPayload());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.phoneNumber).toBe("+250700000001");
    });

    test("should return 400 for missing required fields", async () => {
      const res = await request(app).post("/auth/register").send({
        phoneNumber: "+250700000001",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should return 409 for duplicate user", async () => {
      await request(app).post("/auth/register").send(registerPayload());

      const res = await request(app).post("/auth/register").send(registerPayload());

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  describe("POST /auth/login", () => {
    test("should login successfully with valid credentials", async () => {
      await request(app).post("/auth/register").send(registerPayload());

      const res = await request(app).post("/auth/login").send({
        identifier: "+250700000001",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    test("should return 400 for missing credentials", async () => {
      const res = await request(app).post("/auth/login").send({
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("should return 401 for invalid credentials", async () => {
      await request(app).post("/auth/register").send(registerPayload());

      const res = await request(app).post("/auth/login").send({
        identifier: "+250700000001",
        password: "wrong-password",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /auth/me", () => {
    test("should return the current user for a valid token", async () => {
      const login = await registerAndLogin("+250700000002");

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${login.body.data.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.phoneNumber).toBe("+250700000002");
    });

    test("should return 401 for a missing token", async () => {
      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("POST /auth/refresh", () => {
    test("should issue a new access token", async () => {
      const login = await registerAndLogin("+250700000003");

      const res = await request(app).post("/auth/refresh").send({
        refreshToken: login.body.data.refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  describe("POST /auth/logout", () => {
    test("should revoke the refresh token", async () => {
      const login = await registerAndLogin("+250700000004");

      const logout = await request(app).post("/auth/logout").send({
        refreshToken: login.body.data.refreshToken,
      });

      expect(logout.status).toBe(200);
      expect(logout.body.success).toBe(true);

      const refresh = await request(app).post("/auth/refresh").send({
        refreshToken: login.body.data.refreshToken,
      });

      expect(refresh.status).toBe(401);
      expect(refresh.body.error.code).toBe("UNAUTHORIZED");
    });
  });
});
