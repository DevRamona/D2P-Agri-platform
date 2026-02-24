const DEFAULT_TIMEOUT_MS = 15_000;

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const normalizeMlPrediction = (item, index) => ({
  imageId: typeof item?.imageId === "string" ? item.imageId : `img-${index + 1}`,
  cropType: typeof item?.cropType === "string" ? item.cropType : "unknown",
  disease: typeof item?.disease === "string" ? item.disease : "unknown",
  confidence: typeof item?.confidence === "number" ? item.confidence : 0,
  modelVersion: typeof item?.modelVersion === "string" ? item.modelVersion : "unknown",
  latencyMs: typeof item?.latencyMs === "number" ? item.latencyMs : 0,
  warnings: Array.isArray(item?.warnings) ? item.warnings.filter((w) => typeof w === "string") : [],
});

const predictDiseaseBatch = async ({ files, cropHint, mode }) => {
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

  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error("ML inference request failed");
      error.status = 502;
      error.code = "ML_SERVICE_ERROR";
      error.details = { status: response.status, body: text.slice(0, 500) };
      throw error;
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      const error = new Error("ML service returned an unexpected response");
      error.status = 502;
      error.code = "ML_SERVICE_SCHEMA_ERROR";
      throw error;
    }

    return payload.map(normalizeMlPrediction);
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

module.exports = { predictDiseaseBatch };
