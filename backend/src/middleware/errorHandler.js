const { failure } = require("../utils/response");

const STATUS_BY_CODE = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  ML_SERVICE_UNAVAILABLE: 503,
  ML_SERVICE_TIMEOUT: 504,
  ML_SERVICE_ERROR: 502,
  ML_SERVICE_SCHEMA_ERROR: 502,
  LLM_NOT_CONFIGURED: 503,
  LLM_TIMEOUT: 504,
  LLM_UPSTREAM_ERROR: 502,
  LLM_EMPTY_RESPONSE: 502,
};

const EXPOSED_5XX_CODES = new Set([
  "ML_SERVICE_UNAVAILABLE",
  "ML_SERVICE_TIMEOUT",
  "ML_SERVICE_ERROR",
  "ML_SERVICE_SCHEMA_ERROR",
  "LLM_NOT_CONFIGURED",
  "LLM_TIMEOUT",
  "LLM_UPSTREAM_ERROR",
  "LLM_EMPTY_RESPONSE",
]);

const isValidStatus = (value) => Number.isInteger(value) && value >= 400 && value <= 599;

const resolveStatus = (error) => {
  if (isValidStatus(error?.status)) return error.status;
  if (error?.code && STATUS_BY_CODE[error.code]) return STATUS_BY_CODE[error.code];
  return 500;
};

const resolveCode = (error, status) => {
  if (error?.code) return String(error.code);
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "UPSTREAM_ERROR";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status === 504) return "GATEWAY_TIMEOUT";
  return "INTERNAL_ERROR";
};

const resolveMessage = (error, status, code) => {
  if (status >= 500) {
    const maybeMessage = typeof error?.message === "string" ? error.message.trim() : "";
    if (EXPOSED_5XX_CODES.has(code) && maybeMessage) {
      return maybeMessage;
    }
    return "Internal server error";
  }
  return String(error?.message || "Request failed");
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = resolveStatus(error);
  const code = resolveCode(error, status);
  const message = resolveMessage(error, status, code);
  const details = error?.details || null;

  if (status >= 500) {
    console.error("Unhandled error:", {
      code,
      message: error?.message,
      stack: error?.stack,
      details,
      method: req?.method,
      path: req?.originalUrl || req?.url,
    });
  }

  return res.status(status).json(failure(code, message, details));
};

module.exports = { errorHandler };
