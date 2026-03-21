process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.SAVE_UPLOADS = "false";
process.env.LLM_API_KEY = "test-key";
process.env.LLM_MODEL = "test-model";

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
    expect(String(global.fetch.mock.calls[0][0])).toContain("/predict");
  });

  test("POST /api/disease/generate returns diagnosis and recommendation", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          imageId: "img-gen-1",
          cropType: "bean",
          disease: "bean_rust",
          candidateDisease: "bean_rust",
          diagnosis: "Bean Rust",
          recommendation: "Remove infected leaves and monitor field moisture.",
          generatedText: "Disease: Bean Rust. Advice: Remove infected leaves and monitor field moisture.",
          confidence: 0,
          isUncertain: false,
          uncertaintyReasons: [],
          modelVersion: "paligemma-rwanda-lora-v1",
          latencyMs: 30.2,
          warnings: [],
        },
      ],
    });

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

    const res = await request(app)
      .post("/api/disease/generate")
      .field("cropHint", "beans")
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
        diagnosis: expect.any(String),
        recommendation: expect.any(String),
        generatedText: expect.any(String),
        modelVersion: expect.any(String),
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String(global.fetch.mock.calls[0][0])).toContain("/generate");
  });

  test("POST /api/disease/analyze surfaces ML availability errors", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:8000"));
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

    try {
      const res = await request(app)
        .post("/api/disease/analyze")
        .field("cropHint", "auto")
        .field("mode", "camera")
        .attach("images", fakeJpeg, {
          filename: "camera-capture.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(503);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: "ML_SERVICE_UNAVAILABLE",
            message: expect.stringContaining("Unable to reach ML inference service"),
          }),
        }),
      );
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test("POST /api/disease/analyze falls back to /generate when /predict is unavailable", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () =>
          JSON.stringify({
            detail: "Torch classifier model is not configured (missing MODEL_PATH). Only /generate is available.",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            imageId: "img-fallback-1",
            cropType: "bean",
            disease: "bean_rust",
            candidateDisease: "bean_rust",
            diagnosis: "Bean Rust",
            recommendation: "Use resistant varieties and remove infected leaves.",
            generatedText: "Disease: Bean Rust. Advice: Use resistant varieties and remove infected leaves.",
            confidence: 0,
            isUncertain: true,
            uncertaintyReasons: ["Classifier unavailable; fallback generation used."],
            modelVersion: "paligemma-rwanda-lora-v1",
            latencyMs: 42,
            warnings: [],
          },
        ],
      });

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

    const res = await request(app)
      .post("/api/disease/analyze")
      .field("cropHint", "beans")
      .field("mode", "camera")
      .attach("images", fakeJpeg, {
        filename: "camera-capture.jpg",
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
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(String(global.fetch.mock.calls[0][0])).toContain("/predict");
    expect(String(global.fetch.mock.calls[1][0])).toContain("/generate");
  });

test("POST /api/disease/analyze uses /generate directly when DISEASE_ANALYZE_MODEL=paligemma", async () => {
    const previous = process.env.DISEASE_ANALYZE_MODEL;
    process.env.DISEASE_ANALYZE_MODEL = "paligemma";

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          imageId: "img-paligemma-1",
          cropType: "bean",
          disease: "bean_rust",
          candidateDisease: "bean_rust",
          diagnosis: "Bean Rust",
          recommendation: "Remove infected leaves and monitor spread.",
          generatedText: "Disease: Bean Rust. Advice: Remove infected leaves and monitor spread.",
          confidence: 0.0,
          isUncertain: true,
          uncertaintyReasons: ["Classifier unavailable; fallback generation used."],
          modelVersion: "paligemma-rwanda-lora-v1",
          latencyMs: 38,
          warnings: [],
        },
      ],
    });

    try {
      const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);

      const res = await request(app)
        .post("/api/disease/analyze")
        .field("cropHint", "beans")
        .field("mode", "upload")
        .attach("images", fakeJpeg, {
          filename: "leaf.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(String(global.fetch.mock.calls[0][0])).toContain("/generate");
    } finally {
      if (previous === undefined) {
        delete process.env.DISEASE_ANALYZE_MODEL;
      } else {
        process.env.DISEASE_ANALYZE_MODEL = previous;
      }
    }
  });

  test("POST /api/disease/recommendations returns structured guidance", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                {
                  text:
                    "## What this likely is\nBean rust.\n\n## Immediate steps (24-48h)\nScout nearby plants.\n\n## Treatment options\nUse locally approved fungicide.\n\n## Prevention\nImprove spacing.\n\n## When to seek help\nContact an agronomist if spread increases.\n\n## Safety notes\nWear gloves.\nhttps://example.com/bean-rust",
                },
              ],
            },
          },
        ],
      }),
    });

    const res = await request(app).post("/api/disease/recommendations").send({
      cropType: "beans",
      disease: "bean_rust",
      confidence: 0.82,
      location: "Rwamagana, Rwanda",
      season: "Season B",
      farmerGoal: "protect yield",
      severity: "moderate",
      language: "en",
    });

    expect(res.status).toBe(200);
    expect(res.body.recommendationsMarkdown).toContain("## What this likely is");
    expect(res.body.safetyNotes).toContain("Wear gloves");
    expect(res.body.citations).toEqual(["https://example.com/bean-rust"]);
  });
});
