const DEFAULT_TIMEOUT_MS = 15_000;

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

const toIpv4LocalhostUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      return parsed.toString().replace(/\/$/, "");
    }
    return raw.replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
};

const buildServiceCandidates = () => {
  const primary = String(ML_SERVICE_URL || "").trim().replace(/\/$/, "");
  const ipv4 = toIpv4LocalhostUrl(primary);
  if (ipv4 && ipv4 !== primary) {
    return [primary, ipv4];
  }
  return [primary];
};

const normalizeMlPrediction = (item, index) => ({
  imageId: typeof item?.imageId === "string" ? item.imageId : `img-${index + 1}`,
  cropType: typeof item?.cropType === "string" ? item.cropType : "unknown",
  disease: typeof item?.disease === "string" ? item.disease : "unknown",
  candidateDisease: typeof item?.candidateDisease === "string" ? item.candidateDisease : undefined,
  confidence: typeof item?.confidence === "number" ? item.confidence : 0,
  isUncertain: typeof item?.isUncertain === "boolean" ? item.isUncertain : false,
  uncertaintyReasons: Array.isArray(item?.uncertaintyReasons)
    ? item.uncertaintyReasons.filter((reason) => typeof reason === "string")
    : [],
  thresholdApplied: typeof item?.thresholdApplied === "number" ? item.thresholdApplied : 0,
  margin: typeof item?.margin === "number" ? item.margin : 0,
  marginThreshold: typeof item?.marginThreshold === "number" ? item.marginThreshold : 0,
  topPredictions: Array.isArray(item?.topPredictions)
    ? item.topPredictions
        .map((prediction) => ({
          cropType: typeof prediction?.cropType === "string" ? prediction.cropType : "unknown",
          disease: typeof prediction?.disease === "string" ? prediction.disease : "unknown",
          confidence: typeof prediction?.confidence === "number" ? prediction.confidence : 0,
        }))
        .filter((prediction) => prediction.confidence >= 0 && prediction.confidence <= 1)
    : [],
  modelVersion: typeof item?.modelVersion === "string" ? item.modelVersion : "unknown",
  latencyMs: typeof item?.latencyMs === "number" ? item.latencyMs : 0,
  warnings: Array.isArray(item?.warnings) ? item.warnings.filter((w) => typeof w === "string") : [],
});

const normalizeMlGeneration = (item, index) => ({
  imageId: typeof item?.imageId === "string" ? item.imageId : `img-${index + 1}`,
  cropType: typeof item?.cropType === "string" ? item.cropType : "unknown",
  disease: typeof item?.disease === "string" ? item.disease : "unknown",
  candidateDisease: typeof item?.candidateDisease === "string" ? item.candidateDisease : undefined,
  diagnosis: typeof item?.diagnosis === "string" ? item.diagnosis : "",
  recommendation: typeof item?.recommendation === "string" ? item.recommendation : "",
  generatedText: typeof item?.generatedText === "string" ? item.generatedText : "",
  source: typeof item?.source === "string" ? item.source : undefined,
  confidence: typeof item?.confidence === "number" ? item.confidence : 0,
  isUncertain: typeof item?.isUncertain === "boolean" ? item.isUncertain : false,
  uncertaintyReasons: Array.isArray(item?.uncertaintyReasons)
    ? item.uncertaintyReasons.filter((reason) => typeof reason === "string")
    : [],
  modelVersion: typeof item?.modelVersion === "string" ? item.modelVersion : "unknown",
  latencyMs: typeof item?.latencyMs === "number" ? item.latencyMs : 0,
  warnings: Array.isArray(item?.warnings) ? item.warnings.filter((w) => typeof w === "string") : [],
});

const buildInferenceFormData = ({ files, cropHint, mode }) => {
  const formData = new FormData();

  files.forEach((file, index) => {
    const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
    formData.append("images", blob, file.originalname || `image-${index + 1}.jpg`);
  });

  if (cropHint) {
    formData.append("cropHint", cropHint);
  }
  if (mode) {
    formData.append("mode", mode);
  }

  return formData;
};

const callMlService = async ({ endpoint, formData, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const serviceCandidates = buildServiceCandidates();

  try {
    let response = null;
    let lastNetworkError = null;
    for (const baseUrl of serviceCandidates) {
      try {
        response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        lastNetworkError = null;
        break;
      } catch (error) {
        lastNetworkError = error;
      }
    }

    if (!response) {
      const error = new Error("Unable to reach ML inference service. Ensure ml-service is running.");
      error.status = 503;
      error.code = "ML_SERVICE_UNAVAILABLE";
      error.details = {
        serviceUrls: serviceCandidates,
        reason: lastNetworkError?.message || "Network request failed",
      };
      throw error;
    }

    if (!response.ok) {
      const text = await response.text();
      const error = new Error("ML inference request failed");
      error.status = 502;
      error.code = "ML_SERVICE_ERROR";
      error.details = { endpoint, status: response.status, body: text.slice(0, 500) };
      throw error;
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      const error = new Error("ML service returned an unexpected response");
      error.status = 502;
      error.code = "ML_SERVICE_SCHEMA_ERROR";
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("ML inference service timed out");
      timeoutError.status = 504;
      timeoutError.code = "ML_SERVICE_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const predictDiseaseBatch = async ({ files, cropHint, mode }) => {
  const formData = buildInferenceFormData({ files, cropHint, mode });

  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const payload = await callMlService({ endpoint: "/predict", formData, timeoutMs });
  return payload.map(normalizeMlPrediction);
};

const generateDiseaseBatch = async ({ files, cropHint, mode }) => {
  const formData = buildInferenceFormData({ files, cropHint, mode });
  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const payload = await callMlService({ endpoint: "/generate", formData, timeoutMs });
  return payload.map(normalizeMlGeneration);
};

module.exports = { predictDiseaseBatch, generateDiseaseBatch };
