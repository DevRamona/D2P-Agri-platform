import { API_BASE, ApiRequestError } from "./client";
import { getAccessToken } from "../utils/authStorage";

export type CropHint = "maize" | "beans" | "auto";
export type AnalyzeMode = "camera" | "upload" | "live";
export type RecommendationLanguage = "en" | "rw";
export type RecommendationSeverity = "mild" | "moderate" | "severe";

export type DiseaseAnalysisResult = {
  imageId: string;
  cropType: "maize" | "bean" | "unknown";
  disease: string;
  confidence: number;
  modelVersion: string;
  latencyMs: number;
  summary?: string;
  warnings?: string[];
};

export type DiseaseRecommendationRequest = {
  cropType: string;
  disease: string;
  confidence: number;
  location?: string;
  locationContext?: {
    country?: string;
    province?: string;
    district?: string;
    sector?: string;
    notes?: string;
  };
  season?: string;
  farmerGoal?: string;
  severity?: RecommendationSeverity;
  language: RecommendationLanguage;
};

export type DiseaseRecommendationResponse = {
  recommendationsMarkdown: string;
  citations?: string[];
  safetyNotes?: string;
};

const buildHeaders = (contentType?: string) => {
  const token = getAccessToken();

  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const readErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as unknown;

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: { message?: string } }).error?.message === "string"
    ) {
      const typedPayload = payload as { error?: { code?: string; message?: string } };
      return {
        code: typedPayload.error?.code || "REQUEST_FAILED",
        message: typedPayload.error?.message || "Request failed",
      };
    }

    if (payload && typeof payload === "object" && "message" in payload) {
      const message = (payload as { message?: string }).message;
      if (typeof message === "string" && message) {
        return { code: "REQUEST_FAILED", message };
      }
    }
  } catch {
    // Ignore parse errors and use fallback below.
  }

  return { code: "REQUEST_FAILED", message: `Request failed with status ${response.status}` };
};

export const analyzeDiseaseImages = async (params: {
  images: File[];
  cropHint?: CropHint;
  mode?: AnalyzeMode;
}): Promise<DiseaseAnalysisResult[]> => {
  const formData = new FormData();

  params.images.forEach((image) => {
    formData.append("images", image);
  });

  if (params.cropHint) {
    formData.append("cropHint", params.cropHint);
  }

  if (params.mode) {
    formData.append("mode", params.mode);
  }

  const response = await fetch(`${API_BASE}/api/disease/analyze`, {
    method: "POST",
    headers: buildHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new ApiRequestError(error.code, error.message);
  }

  return (await response.json()) as DiseaseAnalysisResult[];
};

export const getDiseaseRecommendations = async (
  payload: DiseaseRecommendationRequest,
): Promise<DiseaseRecommendationResponse> => {
  const response = await fetch(`${API_BASE}/api/disease/recommendations`, {
    method: "POST",
    headers: buildHeaders("application/json"),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new ApiRequestError(error.code, error.message);
  }

  return (await response.json()) as DiseaseRecommendationResponse;
};
