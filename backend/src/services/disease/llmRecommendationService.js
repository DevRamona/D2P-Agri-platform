const LOW_CONFIDENCE_THRESHOLD = Number(process.env.LLM_LOW_CONFIDENCE_THRESHOLD || 0.65);

const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

const RWANDA_REFERENCE_SOURCES = [
  "Rwanda National Crop Monitor, Season 2021 B overview (July 2021)",
  "RAB Strategic Plan 2020-2024",
];

const RWANDA_CROP_REFERENCE = {
  maize: {
    general: [
      "Use Rwanda-specific maize guidance: eastern districts faced dry spells and fall armyworm pressure in Season 2021 B, while irrigated maize near water sources performed better.",
      "When relevant, recommend early-maturing, drought-tolerant maize varieties and irrigation near reliable water sources for drier eastern and late-planted plots.",
      "Include post-harvest handling, temporary shelter, grain drying, and storage because Rwanda advisories emphasized reducing maize losses after harvest.",
      "RAB strategic guidance highlights hybrid maize varieties adapted to highlands and mid-altitudes with early maturity, drought tolerance, low-nitrogen tolerance, and MLN tolerance.",
      "Where agronomically relevant, mention integrated soil fertility management and updated fertilizer recommendations for maize.",
    ],
    province: {
      east: [
        "Eastern Province maize advice should explicitly consider prolonged dry spells, fall armyworm risk, irrigation, and drought-tolerant varieties.",
      ],
      south: [
        "Southern Province maize advice should account for fall armyworm pressure in late-planted areas and stress careful pest and disease management plus post-harvest handling.",
      ],
      west: [
        "Western Province maize advice should note generally good yields but emphasize irrigation or moisture management where late planting meets June dry conditions.",
      ],
      north: [
        "Northern Province maize guidance should acknowledge that maize may be off-season or reduced by early rainfall cessation in many areas.",
      ],
      kigali: [
        "Kigali maize guidance should emphasize storage readiness, post-harvest handling, and protecting hillside maize from moisture stress.",
      ],
    },
  },
  bean: {
    general: [
      "Use Rwanda-specific bean guidance: beans were generally favorable in Season 2021 B, but heavy March-April rains and localized rainfall stress reduced output in some districts.",
      "Recommend respect for bean production calendars, variety selection suited to local edaphic and climatic conditions, and good agricultural practices.",
      "Include storage, drying, and market preparation because Rwanda advisories repeatedly emphasized preserving bean harvests and reducing post-harvest losses.",
      "RAB strategic guidance highlights bush and climbing bean varieties, biofortified bean lines, and the importance of stronger post-harvest handling because bean losses can be significant.",
      "For climbing beans, mention stakes and canopy support when relevant.",
    ],
    province: {
      east: [
        "Eastern Province bean advice should consider both excessive mid-season rainfall in some areas and inadequate rainfall in others such as Gatsibo, and tie recommendations to calendar discipline and locally suitable varieties.",
      ],
      south: [
        "Southern Province bean guidance should consider damage from excessive rains during germination and emphasize preserving remaining yield through careful post-harvest handling.",
      ],
      west: [
        "Western Province bean guidance should reinforce continued crop care, irrigation where applicable, and market preparation because good bean yields are often expected there.",
      ],
      north: [
        "Northern Province bean guidance should mention timely land preparation, weeding, strong stakes for climbing beans, and organized grain storage.",
      ],
      kigali: [
        "Kigali bean advice should include storage readiness and preserving harvest quality after generally favorable growing conditions.",
      ],
    },
  },
};

const normalizeCropType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "beans" || normalized === "bean") return "bean";
  if (normalized === "maize" || normalized === "corn") return "maize";
  return normalized;
};

const provinceKeyFromValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("north")) return "north";
  if (normalized.includes("south")) return "south";
  if (normalized.includes("east")) return "east";
  if (normalized.includes("west")) return "west";
  if (normalized.includes("kigali")) return "kigali";
  return null;
};

const buildCropReferenceLines = ({ cropType, locationContext }) => {
  const normalizedCrop = normalizeCropType(cropType);
  const cropProfile =
    normalizedCrop === "bean"
      ? RWANDA_CROP_REFERENCE.bean
      : normalizedCrop === "maize"
        ? RWANDA_CROP_REFERENCE.maize
        : null;

  if (!cropProfile) {
    return [];
  }

  const provinceKey = provinceKeyFromValue(locationContext?.province);
  const provinceLines = provinceKey ? cropProfile.province[provinceKey] || [] : [];

  return [
    ...RWANDA_REFERENCE_SOURCES.map((source) => `Source context: ${source}`),
    ...cropProfile.general,
    ...provinceLines,
  ];
};

const extractTextFromChoice = (choice) => {
  const content = choice?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }

  return "";
};

const extractUrls = (markdown) => {
  const matches = markdown.match(/https?:\/\/[^\s)\]]+/g) || [];
  return Array.from(new Set(matches));
};

const extractSafetyNotesSection = (markdown) => {
  const match = markdown.match(/(?:^|\n)#+\s*Safety notes\s*\n([\s\S]*?)(?=\n#+\s|\s*$)/i);
  return match ? match[1].trim() : undefined;
};

class OpenAICompatibleLlmClient {
  constructor() {
    const explicitApiKey = process.env.LLM_API_KEY || "";
    const explicitModel = process.env.LLM_MODEL || "";
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    this.provider = explicitApiKey && explicitModel ? "openai-compatible" : geminiApiKey ? "gemini" : "unconfigured";
    this.apiKey = explicitApiKey || geminiApiKey;
    this.model =
      explicitModel || process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || (this.provider === "gemini" ? "gemini-2.5-flash" : "");
    this.baseUrl = (
      process.env.LLM_BASE_URL || (this.provider === "gemini" ? GEMINI_OPENAI_BASE_URL : "https://api.openai.com/v1")
    ).replace(/\/$/, "");
    this.chatPath = process.env.LLM_CHAT_COMPLETIONS_PATH || "/chat/completions";
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 20_000);
    this.temperature = Number(process.env.LLM_TEMPERATURE || 0.3);
  }

  isConfigured() {
    return Boolean(this.apiKey && this.model);
  }

  async generateStructuredMarkdown({ systemPrompt, userPrompt }) {
    if (!this.isConfigured()) {
      const error = new Error(
        "LLM is not configured. Set LLM_API_KEY and LLM_MODEL, or set GEMINI_API_KEY to use Gemini.",
      );
      error.status = 503;
      error.code = "LLM_NOT_CONFIGURED";
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${this.chatPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: this.temperature,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error("LLM request failed");
        error.status = 502;
        error.code = "LLM_UPSTREAM_ERROR";
        error.details = {
          status: response.status,
          response: payload,
        };
        throw error;
      }

      const text = extractTextFromChoice(payload?.choices?.[0]);
      if (!text) {
        const error = new Error("LLM returned an empty response");
        error.status = 502;
        error.code = "LLM_EMPTY_RESPONSE";
        throw error;
      }

      return text.trim();
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("LLM request timed out");
        timeoutError.status = 504;
        timeoutError.code = "LLM_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

const languageLabel = (language) => (language === "rw" ? "Kinyarwanda" : "English");

const buildPrompts = ({ cropType, disease, confidence, location, locationContext, season, farmerGoal, severity, language }) => {
  const uncertainDisease = String(disease || "").toLowerCase() === "uncertain";
  const lowConfidence = uncertainDisease || Number(confidence) < LOW_CONFIDENCE_THRESHOLD;
  const locale = location || "Rwanda";
  const outputLanguage = languageLabel(language);
  const normalizedCrop = normalizeCropType(cropType);
  const structuredLocationLines = locationContext
    ? [
        `Country: ${locationContext.country || "Rwanda"}`,
        `Province: ${locationContext.province || "Unknown"}`,
        `District: ${locationContext.district || "Not provided"}`,
        `Sector: ${locationContext.sector || "Not provided"}`,
        `Agro-ecological zone / altitude profile: ${locationContext.agroEcologicalZone || "Unknown"}`,
        `Climate pattern: ${locationContext.climatePattern || "Unknown"}`,
        `Disease pressure pattern: ${locationContext.diseasePressure || "Unknown"}`,
        `Rainfall tendency: ${locationContext.rainfallBias || "Unknown"}`,
        `Advisory focus priorities: ${
          Array.isArray(locationContext.advisoryFocus) ? locationContext.advisoryFocus.join(", ") : "scouting"
        }`,
        locationContext.notes ? `Farmer local notes: ${locationContext.notes}` : null,
      ].filter(Boolean)
    : [];
  const cropReferenceLines = buildCropReferenceLines({
    cropType: normalizedCrop,
    locationContext,
  });

  const systemPrompt = [
    "You are an agricultural advisory assistant for smallholder farmers.",
    "Generate practical, safety-first crop disease guidance.",
    `All advice must be tailored to local context in ${locale}, especially district/province differences in Rwanda, mention uncertainty when confidence is low, and avoid pretending to confirm a diagnosis.`,
    `Be crop-specific for ${normalizedCrop || cropType}. Use the Rwanda reference context provided by the caller as binding agronomic guidance for maize and bean responses.`,
    "Return Markdown only with exactly these section headings:",
    "## What this likely is",
    "## Immediate steps (24-48h)",
    "## Treatment options",
    "## Prevention",
    "## When to seek help",
    "## Safety notes",
    `Write in ${outputLanguage}.`,
  ].join(" ");

  const userPrompt = [
    "Generate recommendations for a crop disease scan.",
    `Crop type: ${cropType}`,
    `Predicted disease: ${disease}`,
    `Model confidence: ${Math.round(Number(confidence) * 100)}%`,
    `Location context: ${locale}`,
    ...(structuredLocationLines.length > 0 ? ["Structured Rwanda location context:", ...structuredLocationLines] : []),
    ...(cropReferenceLines.length > 0 ? ["Rwanda crop reference guidance:", ...cropReferenceLines] : []),
    `Season: ${season || "Not provided"}`,
    `Farmer goal: ${farmerGoal || "Not provided"}`,
    `Observed severity by farmer: ${severity || "Not provided"}`,
    `Low-confidence threshold: ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}%`,
    lowConfidence
      ? "Confidence is below threshold. Ask for additional photos (front/back leaf, whole plant, stem, nearby plants) and provide conservative interim advice only."
      : "Provide specific, actionable recommendations while reminding the user to confirm severe cases with a trained agronomist.",
    "Include likely cause, immediate actions, treatment options, prevention, safety warnings, and when to contact an agronomist.",
    "Be specific about how recommendations may differ for wetter highland districts versus warmer drier eastern districts when relevant.",
    "If the crop is maize, include maize-specific risk factors such as fall armyworm pressure, drought stress, irrigation access, variety choice, and grain drying/storage when relevant.",
    "If the crop is bean, include bean-specific risk factors such as heavy-rain germination stress, climbing-bean staking, crop calendar discipline, storage quality, and local variety suitability when relevant.",
    "Tailor urgency to observed severity: mild = early intervention and monitoring; moderate = immediate containment + treatment planning; severe = stronger containment, escalation, and agronomist referral.",
    "If disease is healthy, focus on preventive care and monitoring instead of treatment.",
  ].join("\n");

  return { systemPrompt, userPrompt };
};

const llmClient = new OpenAICompatibleLlmClient();

const generateDiseaseRecommendations = async (payload) => {
  const { systemPrompt, userPrompt } = buildPrompts(payload);
  const recommendationsMarkdown = await llmClient.generateStructuredMarkdown({
    systemPrompt,
    userPrompt,
  });

  const citations = extractUrls(recommendationsMarkdown);
  const safetyNotes = extractSafetyNotesSection(recommendationsMarkdown);

  return {
    recommendationsMarkdown,
    ...(citations.length > 0 ? { citations } : {}),
    ...(safetyNotes ? { safetyNotes } : {}),
  };
};

module.exports = {
  LOW_CONFIDENCE_THRESHOLD,
  OpenAICompatibleLlmClient,
  buildPrompts,
  generateDiseaseRecommendations,
};


