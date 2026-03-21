process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";

const request = require("supertest");
const { app } = require("../src/app");

describe("API docs", () => {
  test("GET /docs/openapi.json returns the generated spec", async () => {
    const res = await request(app).get("/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths["/auth/login"]).toBeDefined();
    expect(res.body.paths["/api/disease/analyze"]).toBeDefined();
    expect(res.body.paths["/admin/overview"]).toBeDefined();
  });

  test("GET /docs/ serves the Swagger UI page", async () => {
    const res = await request(app).get("/docs/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});
