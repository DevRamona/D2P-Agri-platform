process.env.DB_URL = "mongodb://localhost:27017/test";
process.env.JWT_ACCESS_SECRET = "test_access";
process.env.JWT_REFRESH_SECRET = "test_refresh";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";

describe("LLM recommendation service", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_CHAT_COMPLETIONS_PATH;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_MODEL;
    process.env.GEMINI_API_KEY = "gemini-test-key";
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  test("uses Gemini OpenAI-compatible endpoint and injects maize-specific Rwanda guidance", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "## What this likely is\nMaize disease.\n\n## Immediate steps (24-48h)\nScout the field.\n\n## Treatment options\nApply an approved control.\n\n## Prevention\nImprove field hygiene.\n\n## When to seek help\nContact an agronomist if spread increases.\n\n## Safety notes\nWear gloves.",
            },
          },
        ],
      }),
    });

    const { generateDiseaseRecommendations } = require("../src/services/disease/llmRecommendationService");

    await generateDiseaseRecommendations({
      cropType: "maize",
      disease: "fall_armyworm_damage",
      confidence: 0.84,
      location: "Kayonza, Eastern, Rwanda",
      locationContext: {
        country: "Rwanda",
        province: "Eastern",
        district: "Kayonza",
        agroEcologicalZone: "plateau/lowland",
        climatePattern: "hotter and often drier conditions",
        diseasePressure: "stress-linked outbreaks after rain or irrigation",
        advisoryFocus: ["water management", "post-rain scouting"],
        rainfallBias: "low-moderate",
      },
      season: "Season B",
      farmerGoal: "protect yield",
      severity: "moderate",
      language: "en",
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, requestInit] = global.fetch.mock.calls[0];
    const payload = JSON.parse(requestInit.body);
    const userPrompt = payload.messages[1].content;

    expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(payload.model).toBe("gemini-2.5-flash");
    expect(userPrompt).toContain("fall armyworm");
    expect(userPrompt).toContain("drought-tolerant maize varieties");
    expect(userPrompt).toContain("Rwanda National Crop Monitor, Season 2021 B overview (July 2021)");
    expect(userPrompt).toContain("RAB Strategic Plan 2020-2024");
  });

  test("builds bean-specific prompt context from Rwanda guidance", () => {
    const { buildPrompts } = require("../src/services/disease/llmRecommendationService");

    const { systemPrompt, userPrompt } = buildPrompts({
      cropType: "beans",
      disease: "bean_rust",
      confidence: 0.78,
      location: "Gicumbi, Northern, Rwanda",
      locationContext: {
        country: "Rwanda",
        province: "Northern",
        district: "Gicumbi",
        agroEcologicalZone: "highland",
        climatePattern: "cooler temperatures with frequent moisture",
        diseasePressure: "higher foliar fungal pressure during wet periods",
        advisoryFocus: ["airflow and spacing", "timely scouting"],
        rainfallBias: "high",
      },
      season: "Season B",
      farmerGoal: "preserve bean harvest",
      severity: "mild",
      language: "en",
    });

    expect(systemPrompt).toContain("Be crop-specific for bean");
    expect(userPrompt).toContain("respect for bean production calendars");
    expect(userPrompt).toContain("strong stakes");
    expect(userPrompt).toContain("post-harvest");
    expect(userPrompt).toContain("RAB Strategic Plan 2020-2024");
  });
});
