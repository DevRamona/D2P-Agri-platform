const http = require("http");
const https = require("https");

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_GENERATE_TIMEOUT_MS = 120_000;

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

const supportsFetchMultipart = () =>
  typeof fetch === "function" && typeof FormData === "function" && typeof Blob === "function";

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

const sanitizeHeaderToken = (value) =>
  String(value || "")
    .replace(/[\r\n"]/g, "_")
    .trim();

const toBuffer = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(String(value || ""), "utf8");
};

const buildInferenceMultipartBody = ({ files, cropHint, mode }) => {
  const boundary = `----d2p-agri-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  const push = (value) => chunks.push(toBuffer(value));

  const appendTextField = (name, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${sanitizeHeaderToken(name)}"\r\n\r\n`);
    push(`${String(value)}\r\n`);
  };

  const appendImage = (file, index) => {
    const fileName = sanitizeHeaderToken(file?.originalname || `image-${index + 1}.jpg`);
    const mimeType = String(file?.mimetype || "application/octet-stream");

    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="images"; filename="${fileName}"\r\n`);
    push(`Content-Type: ${mimeType}\r\n\r\n`);
    push(toBuffer(file?.buffer || ""));
    push("\r\n");
  };

  files.forEach(appendImage);
  appendTextField("cropHint", cropHint);
  appendTextField("mode", mode);
  push(`--${boundary}--\r\n`);

  const body = Buffer.concat(chunks);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

const createRequestPayloadFactory = ({ files, cropHint, mode }) => {
  if (supportsFetchMultipart()) {
    return () => ({
      transport: "fetch",
      formData: buildInferenceFormData({ files, cropHint, mode }),
    });
  }

  const multipart = buildInferenceMultipartBody({ files, cropHint, mode });
  return () => ({
    transport: "http",
    multipart,
  });
};

const requestWithNodeHttp = ({ baseUrl, endpoint, multipart, timeoutMs }) =>
  new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(`${baseUrl}${endpoint}`);
    } catch (error) {
      reject(error);
      return;
    }

    const transport = target.protocol === "https:" ? https : http;
    const requestOptions = {
      method: "POST",
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      headers: {
        "Content-Type": multipart.contentType,
        "Content-Length": multipart.body.length,
      },
    };

    const req = transport.request(requestOptions, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(toBuffer(chunk)));
      res.on("end", () => {
        const status = Number(res.statusCode || 0);
        resolve({
          ok: status >= 200 && status < 300,
          status,
          bodyText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.code = "ETIMEDOUT";
      req.destroy(timeoutError);
    });

    req.write(multipart.body);
    req.end();
  });

const readResponseText = async (response) => {
  if (typeof response?.text === "function") {
    return response.text();
  }

  if (typeof response?.bodyText === "string") {
    return response.bodyText;
  }

  return "";
};

const readResponseJson = async (response) => {
  if (typeof response?.json === "function") {
    return response.json();
  }

  const text = await readResponseText(response);
  return JSON.parse(text);
};

const extractUpstreamErrorMessage = (bodyText) => {
  const raw = String(bodyText || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.detail === "string" && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (
        parsed.error &&
        typeof parsed.error === "object" &&
        typeof parsed.error.message === "string" &&
        parsed.error.message.trim()
      ) {
        return parsed.error.message.trim();
      }
    }
  } catch {
    // Fall back to plain text handling.
  }

  return raw.slice(0, 240);
};

const isTimeoutError = (error) => {
  const message = String(error?.message || "");
  return (
    error?.name === "AbortError" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "ESOCKETTIMEDOUT" ||
    /timed out/i.test(message)
  );
};

const callMlService = async ({ endpoint, payloadFactory, timeoutMs }) => {
  const serviceCandidates = buildServiceCandidates();

  try {
    let response = null;
    let lastNetworkError = null;
    for (const baseUrl of serviceCandidates) {
      const payload = payloadFactory();
      try {
        if (payload.transport === "fetch") {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            response = await fetch(`${baseUrl}${endpoint}`, {
              method: "POST",
              body: payload.formData,
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }
        } else {
          response = await requestWithNodeHttp({
            baseUrl,
            endpoint,
            multipart: payload.multipart,
            timeoutMs,
          });
        }
        lastNetworkError = null;
        break;
      } catch (error) {
        lastNetworkError = error;
      }
    }

    if (!response) {
      if (isTimeoutError(lastNetworkError)) {
        const timeoutError = new Error(
          "ML inference service timed out. The model may still be loading; retry in 30-60 seconds.",
        );
        timeoutError.status = 504;
        timeoutError.code = "ML_SERVICE_TIMEOUT";
        throw timeoutError;
      }

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
      const text = await readResponseText(response);
      const upstreamMessage = extractUpstreamErrorMessage(text);
      const error = new Error(
        upstreamMessage ? `ML inference request failed: ${upstreamMessage}` : "ML inference request failed",
      );
      error.status = 502;
      error.code = "ML_SERVICE_ERROR";
      error.details = {
        endpoint,
        status: response.status,
        upstreamMessage: upstreamMessage || undefined,
        body: text.slice(0, 500),
      };
      throw error;
    }

    let payload;
    try {
      payload = await readResponseJson(response);
    } catch {
      const error = new Error("ML service returned an unexpected response");
      error.status = 502;
      error.code = "ML_SERVICE_SCHEMA_ERROR";
      throw error;
    }

    if (!Array.isArray(payload)) {
      const error = new Error("ML service returned an unexpected response");
      error.status = 502;
      error.code = "ML_SERVICE_SCHEMA_ERROR";
      throw error;
    }

    return payload;
  } catch (error) {
    if (isTimeoutError(error)) {
      const timeoutError = new Error(
        "ML inference service timed out. The model may still be loading; retry in 30-60 seconds.",
      );
      timeoutError.status = 504;
      timeoutError.code = "ML_SERVICE_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  }
};

const predictDiseaseBatch = async ({ files, cropHint, mode }) => {
  const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const payloadFactory = createRequestPayloadFactory({ files, cropHint, mode });
  const payload = await callMlService({ endpoint: "/predict", payloadFactory, timeoutMs });
  return payload.map(normalizeMlPrediction);
};

const generateDiseaseBatch = async ({ files, cropHint, mode }) => {
  const configuredGenerateTimeout = Number(process.env.ML_SERVICE_GENERATE_TIMEOUT_MS || 0);
  const baseTimeout = Number(process.env.ML_SERVICE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(configuredGenerateTimeout) && configuredGenerateTimeout > 0
      ? configuredGenerateTimeout
      : Math.max(baseTimeout, DEFAULT_GENERATE_TIMEOUT_MS);
  const payloadFactory = createRequestPayloadFactory({ files, cropHint, mode });
  const payload = await callMlService({ endpoint: "/generate", payloadFactory, timeoutMs });
  return payload.map(normalizeMlGeneration);
};

module.exports = { predictDiseaseBatch, generateDiseaseBatch };
