process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.SAVE_UPLOADS = "false";

const request = require("supertest");
const { app } = require("../src/app");

describe("Disease API", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          imageId: "img-test-1",
          cropType: "bean",
          disease: "bean_rust",
          confidence: 0.82,
          modelVersion: "mock-v1",
          latencyMs: 24.5,
          warnings: ["Image may be blurry. Hold camera steady and refocus."],
        },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("POST /api/disease/analyze returns expected schema", async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

    const res = await request(app)
      .post("/api/disease/analyze")
      .field("cropHint", "auto")
      .field("mode", "upload")
      .attach("images", fakeJpeg, {
        filename: "leaf.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        imageId: expect.any(String),
        cropType: expect.any(String),
        disease: expect.any(String),
        confidence: expect.any(Number),
        modelVersion: expect.any(String),
        latencyMs: expect.any(Number),
        summary: expect.any(String),
        warnings: expect.any(Array),
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
