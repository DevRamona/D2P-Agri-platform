const LOW_CONFIDENCE_THRESHOLD = Number(process.env.LLM_LOW_CONFIDENCE_THRESHOLD || 0.65);

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
    this.apiKey = process.env.LLM_API_KEY || "";
    this.model = process.env.LLM_MODEL || "";
    this.baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    this.chatPath = process.env.LLM_CHAT_COMPLETIONS_PATH || "/chat/completions";
    this.timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 20_000);
    this.temperature = Number(process.env.LLM_TEMPERATURE || 0.3);
  }

  isConfigured() {
    return Boolean(this.apiKey && this.model);
  }

  async generateStructuredMarkdown({ systemPrompt, userPrompt }) {
    if (!this.isConfigured()) {
      const error = new Error("LLM is not configured. Set LLM_API_KEY and LLM_MODEL.");
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
  const lowConfidence = Number(confidence) < LOW_CONFIDENCE_THRESHOLD;
  const locale = location || "Rwanda";
  const outputLanguage = languageLabel(language);
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

  const systemPrompt = [
    "You are an agricultural advisory assistant for smallholder farmers.",
    "Generate practical, safety-first crop disease guidance.",
    `All advice must be tailored to local context in ${locale}, especially district/province differences in Rwanda, mention uncertainty when confidence is low, and avoid pretending to confirm a diagnosis.`,
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
    `Season: ${season || "Not provided"}`,
    `Farmer goal: ${farmerGoal || "Not provided"}`,
    `Observed severity by farmer: ${severity || "Not provided"}`,
    `Low-confidence threshold: ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}%`,
    lowConfidence
      ? "Confidence is below threshold. Ask for additional photos (front/back leaf, whole plant, stem, nearby plants) and provide conservative interim advice only."
      : "Provide specific, actionable recommendations while reminding the user to confirm severe cases with a trained agronomist.",
    "Include likely cause, immediate actions, treatment options, prevention, safety warnings, and when to contact an agronomist.",
    "Be specific about how recommendations may differ for wetter highland districts versus warmer drier eastern districts when relevant.",
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
  generateDiseaseRecommendations,
};


