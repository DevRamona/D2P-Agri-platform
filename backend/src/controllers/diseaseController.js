const crypto = require("crypto");
const { predictDiseaseBatch, generateDiseaseBatch } = require("../services/disease/mlInferenceClient");
const { generateDiseaseRecommendations } = require("../services/disease/llmRecommendationService");
const { createStorageProvider } = require("../services/disease/storage");
const { buildExplanationSummary } = require("../services/disease/summary");
const { store_anonymized_feedback } = require("../services/disease/feedback");
const { resolveRwandaLocationContext } = require("../services/disease/rwandaLocationContext");

const storageProvider = createStorageProvider();

const VALID_CROP_HINTS = new Set(["maize", "beans", "auto"]);
const VALID_MODES = new Set(["camera", "upload", "live"]);
const VALID_LANGUAGES = new Set(["en", "rw"]);
const VALID_RECOMMENDATION_CROPS = new Set(["maize", "bean", "beans"]);
const VALID_SEVERITIES = new Set(["mild", "moderate", "severe"]);

const createHttpError = (status, code, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
};

const normalizeCropType = (value, cropHint) => {
  const raw = String(value || "").toLowerCase();
  if (raw === "beans" || raw === "bean") {
    return "bean";
  }
  if (raw === "maize" || raw === "corn") {
    return "maize";
  }
  if (cropHint === "beans") {
    return "bean";
  }
  if (cropHint === "maize") {
    return "maize";
  }
  return "unknown";
};

const normalizeRecommendationCropType = (value) => {
  const crop = String(value || "").toLowerCase();
  if (crop === "beans") return "bean";
  return crop;
};

const parseAnalyzeParams = (body) => {
  const cropHint = String(body.cropHint || "auto").toLowerCase();
  const mode = String(body.mode || "upload").toLowerCase();

  if (!VALID_CROP_HINTS.has(cropHint)) {
    throw createHttpError(400, "BAD_REQUEST", "cropHint must be one of maize|beans|auto");
  }

  if (!VALID_MODES.has(mode)) {
    throw createHttpError(400, "BAD_REQUEST", "mode must be one of camera|upload|live");
  }

  return { cropHint, mode };
};

const analyze = async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      throw createHttpError(400, "BAD_REQUEST", "images[] is required");
    }

    const { cropHint, mode } = parseAnalyzeParams(req.body || {});

    await Promise.all(
      files.map((file) =>
        storageProvider.save({
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
        }),
      ),
    );

    const predictions = await predictDiseaseBatch({
      files,
      cropHint,
      mode,
    });

    const responsePayload = predictions.map((prediction, index) => {
      const imageId = prediction.imageId || crypto.randomUUID();
      const normalizedCropType = normalizeCropType(prediction.cropType, cropHint);
      const confidence = Math.max(0, Math.min(1, Number(prediction.confidence || 0)));
      const warnings = Array.isArray(prediction.warnings) ? prediction.warnings : [];
      const uncertaintyReasons = Array.isArray(prediction.uncertaintyReasons) ? prediction.uncertaintyReasons : [];
      const topPredictions = Array.isArray(prediction.topPredictions) ? prediction.topPredictions : [];
      const candidateDisease = String(prediction.candidateDisease || prediction.disease || "unknown");
      const thresholdApplied = Number(prediction.thresholdApplied || 0);

      return {
        imageId,
        cropType: normalizedCropType,
        disease: String(prediction.disease || "unknown"),
        candidateDisease,
        confidence,
        isUncertain: Boolean(prediction.isUncertain),
        uncertaintyReasons,
        thresholdApplied,
        margin: Number(prediction.margin || 0),
        marginThreshold: Number(prediction.marginThreshold || 0),
        topPredictions,
        modelVersion: String(prediction.modelVersion || "unknown"),
        latencyMs: Number(prediction.latencyMs || 0),
        summary: buildExplanationSummary({
          cropType: normalizedCropType,
          disease: prediction.disease,
          candidateDisease,
          confidence,
          warnings,
          isUncertain: Boolean(prediction.isUncertain),
          uncertaintyReasons,
          thresholdApplied,
        }),
        warnings,
        _index: index,
      };
    });

    res.status(200).json(responsePayload.map(({ _index, ...item }) => item));
  } catch (error) {
    next(error);
  }
};

const analyzeGenerative = async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      throw createHttpError(400, "BAD_REQUEST", "images[] is required");
    }

    const { cropHint, mode } = parseAnalyzeParams(req.body || {});

    await Promise.all(
      files.map((file) =>
        storageProvider.save({
          buffer: file.buffer,
          mimeType: file.mimetype,
          originalName: file.originalname,
        }),
      ),
    );

    const generations = await generateDiseaseBatch({
      files,
      cropHint,
      mode,
    });

    const responsePayload = generations.map((item) => {
      const imageId = item.imageId || crypto.randomUUID();
      const normalizedCropType = normalizeCropType(item.cropType, cropHint);
      const confidence = Math.max(0, Math.min(1, Number(item.confidence || 0)));
      const warnings = Array.isArray(item.warnings) ? item.warnings : [];
      const uncertaintyReasons = Array.isArray(item.uncertaintyReasons) ? item.uncertaintyReasons : [];
      const candidateDisease = String(item.candidateDisease || item.disease || "unknown");
      const disease = String(item.disease || "unknown");

      return {
        imageId,
        cropType: normalizedCropType,
        disease,
        candidateDisease,
        diagnosis: String(item.diagnosis || candidateDisease || disease),
        recommendation: String(item.recommendation || item.generatedText || ""),
        generatedText: String(item.generatedText || ""),
        source: item.source ? String(item.source) : undefined,
        confidence,
        isUncertain: Boolean(item.isUncertain),
        uncertaintyReasons,
        modelVersion: String(item.modelVersion || "unknown"),
        latencyMs: Number(item.latencyMs || 0),
        summary: buildExplanationSummary({
          cropType: normalizedCropType,
          disease,
          candidateDisease,
          confidence,
          warnings,
          isUncertain: Boolean(item.isUncertain),
          uncertaintyReasons,
          thresholdApplied: 0,
        }),
        warnings,
      };
    });

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

const recommendations = async (req, res, next) => {
  try {
    const { cropType, disease, confidence, location, locationContext, season, farmerGoal, severity, language } = req.body || {};

    if (!cropType || !disease || typeof confidence !== "number") {
      throw createHttpError(400, "BAD_REQUEST", "cropType, disease and numeric confidence are required");
    }
    if (!VALID_RECOMMENDATION_CROPS.has(String(cropType).toLowerCase())) {
      throw createHttpError(400, "BAD_REQUEST", "cropType must be bean/beans or maize");
    }

    const normalizedLanguage = String(language || "en").toLowerCase();
    if (!VALID_LANGUAGES.has(normalizedLanguage)) {
      throw createHttpError(400, "BAD_REQUEST", "language must be en or rw");
    }
    const normalizedSeverity = severity ? String(severity).toLowerCase() : undefined;
    if (normalizedSeverity && !VALID_SEVERITIES.has(normalizedSeverity)) {
      throw createHttpError(400, "BAD_REQUEST", "severity must be mild, moderate, or severe");
    }

    const resolvedLocationContext = resolveRwandaLocationContext({
      location,
      locationContext,
    });

    const result = await generateDiseaseRecommendations({
      cropType: normalizeRecommendationCropType(cropType),
      disease: String(disease),
      confidence: Number(confidence),
      location: resolvedLocationContext.displayLocation || "Rwanda",
      locationContext: resolvedLocationContext,
      season: season ? String(season) : undefined,
      farmerGoal: farmerGoal ? String(farmerGoal) : undefined,
      severity: normalizedSeverity,
      language: normalizedLanguage,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyze,
  analyzeGenerative,
  recommendations,
  store_anonymized_feedback,
};
