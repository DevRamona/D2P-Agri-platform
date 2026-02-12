const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
};

export class ApiRequestError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !json.success) {
    const error = json.error || { code: "UNKNOWN", message: "Request failed" };
    throw new ApiRequestError(error.code, error.message, error.details);
  }

  if (json.data === null) {
    throw new ApiRequestError("EMPTY_RESPONSE", "No data returned from API");
  }

  return json.data;
};

export { apiFetch, API_BASE };
