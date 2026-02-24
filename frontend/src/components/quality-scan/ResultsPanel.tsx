import { useEffect, useState } from "react";
import {
  getDiseaseRecommendations,
  type DiseaseAnalysisResult,
  type DiseaseRecommendationResponse,
  type RecommendationLanguage,
  type RecommendationSeverity,
} from "../../api/disease";
import {
  DEFAULT_RWANDA_DISTRICT,
  DEFAULT_RWANDA_PROVINCE,
  RWANDA_PROVINCES,
} from "./rwandaLocations";

type ResultsPanelProps = {
  results: DiseaseAnalysisResult[];
  previewByImageId: Record<string, string>;
  language: RecommendationLanguage;
  onLanguageChange: (language: RecommendationLanguage) => void;
};

type RecommendationState = {
  loading: boolean;
  data?: DiseaseRecommendationResponse;
  error?: string;
};

type RecommendationStateMap = Record<string, RecommendationState>;

const formatDiseaseLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatRecommendationForDisplay = (markdown: string) =>
  markdown
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();

const ResultsPanel = ({ results, previewByImageId, language, onLanguageChange }: ResultsPanelProps) => {
  const [recommendationStates, setRecommendationStates] = useState<RecommendationStateMap>({});
  const [province, setProvince] = useState(DEFAULT_RWANDA_PROVINCE);
  const [district, setDistrict] = useState(DEFAULT_RWANDA_DISTRICT);
  const [locationNotes, setLocationNotes] = useState("");
  const [season, setSeason] = useState("");
  const [farmerGoal, setFarmerGoal] = useState("");
  const [severity, setSeverity] = useState<RecommendationSeverity>("moderate");

  const provinceOptions = RWANDA_PROVINCES;
  const selectedProvince = provinceOptions.find((option) => option.key === province) ?? provinceOptions[0];
  const districtOptions = selectedProvince.districts;

  useEffect(() => {
    if (!districtOptions.includes(district)) {
      setDistrict(districtOptions[0]);
    }
  }, [district, districtOptions]);

  useEffect(() => {
    setRecommendationStates({});
  }, [results]);

  const loadRecommendations = async (result: DiseaseAnalysisResult) => {
    setRecommendationStates((current) => ({
      ...current,
      [result.imageId]: { loading: true },
    }));

    try {
      const data = await getDiseaseRecommendations({
        cropType: result.cropType,
        disease: result.disease,
        confidence: result.confidence,
        location: [district, selectedProvince.label, "Rwanda"].filter(Boolean).join(", "),
        locationContext: {
          country: "Rwanda",
          province: selectedProvince.key,
          district,
          notes: locationNotes || undefined,
        },
        season: season || undefined,
        farmerGoal: farmerGoal || undefined,
        severity,
        language,
      });

      setRecommendationStates((current) => ({
        ...current,
        [result.imageId]: { loading: false, data },
      }));
    } catch (error) {
      setRecommendationStates((current) => ({
        ...current,
        [result.imageId]: {
          loading: false,
          error: error instanceof Error ? error.message : "Failed to fetch recommendations.",
        },
      }));
    }
  };

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-5">
        <p className="m-0 text-sm font-semibold">No analysis results yet</p>
        <p className="m-0 mt-2 text-sm text-[var(--muted)]">
          Capture a live camera image or upload photos, then click Analyze.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="m-0 text-sm font-semibold">Recommendations Language</p>
            <p className="m-0 mt-1 text-xs text-[var(--muted)]">Used for the LLM-generated diagnosis guidance.</p>
          </div>
          <div className="inline-flex rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] p-1">
            <button
              type="button"
              onClick={() => onLanguageChange("en")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                language === "en" ? "bg-[var(--accent)] text-[#0b1307]" : "text-[var(--text)]"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange("rw")}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                language === "rw" ? "bg-[var(--accent)] text-[#0b1307]" : "text-[var(--text)]"
              }`}
            >
              Kinyarwanda
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Province</span>
            <select
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              {provinceOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">District</span>
            <select
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              {districtOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Season (optional)</span>
            <input
              type="text"
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
              placeholder="Rainy season B"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Severity</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as RecommendationSeverity)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-[var(--muted)]">Farmer Goal (optional)</span>
            <input
              type="text"
              value={farmerGoal}
              onChange={(event) => setFarmerGoal(event.target.value)}
              className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
              placeholder="Protect yield / minimize cost"
            />
          </label>
        </div>

        <label className="mt-3 block text-xs">
          <span className="mb-1 block font-semibold text-[var(--muted)]">Local Field Notes (optional)</span>
          <input
            type="text"
            value={locationNotes}
            onChange={(event) => setLocationNotes(event.target.value)}
            className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            placeholder="e.g. hillside plot, irrigated field, recent heavy rain"
          />
        </label>
      </div>

      {results.map((result) => {
        const recommendationState = recommendationStates[result.imageId];
        const isHealthy = result.disease.toLowerCase() === "healthy";
        const previewUrl = previewByImageId[result.imageId];

        return (
          <article
            key={result.imageId}
            className="overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(0,0,0,0.15)]"
          >
            {previewUrl && <img src={previewUrl} alt="Analyzed crop leaf" className="h-44 w-full object-cover" />}

            <div className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="m-0 text-xs font-semibold tracking-[1px] text-[var(--muted)]">
                    {result.cropType.toUpperCase()} | {result.modelVersion}
                  </p>
                  <h3 className="m-0 mt-1 text-lg font-semibold">{formatDiseaseLabel(result.disease)}</h3>
                </div>
                <div className="rounded-full bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold">
                  Confidence {formatPercent(result.confidence)}
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2">
                  <span className="font-semibold">Explanation:</span>{" "}
                  {result.summary || "The model detected visible disease patterns in the leaf image."}
                </div>
                {result.warnings && result.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                    <span className="font-semibold">Image quality warnings:</span> {result.warnings.join("; ")}
                  </div>
                )}
                <div className="text-xs text-[var(--muted)]">Model latency: {result.latencyMs} ms</div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => loadRecommendations(result)}
                  disabled={recommendationState?.loading}
                  className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {recommendationState?.loading
                    ? "Generating..."
                    : isHealthy
                      ? "Get Preventive Tips"
                      : "Get Recommendations"}
                </button>
              </div>

              {recommendationState?.error && (
                <div className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {recommendationState.error}
                </div>
              )}

              {recommendationState?.data && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] p-3">
                    <p className="m-0 mb-2 text-xs font-semibold tracking-[1px] text-[var(--muted)]">
                      LLM Recommendations
                    </p>
                    <pre className="m-0 whitespace-pre-wrap text-sm leading-6 font-sans">
                      {formatRecommendationForDisplay(recommendationState.data.recommendationsMarkdown)}
                    </pre>
                  </div>

                  {recommendationState.data.safetyNotes && (
                    <div className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      <span className="font-semibold">Safety notes:</span> {recommendationState.data.safetyNotes}
                    </div>
                  )}

                  {recommendationState.data.citations && recommendationState.data.citations.length > 0 && (
                    <div className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] px-3 py-2 text-xs">
                      <p className="m-0 font-semibold">Citations</p>
                      <ul className="mt-2 list-disc pl-4">
                        {recommendationState.data.citations.map((citation) => (
                          <li key={citation} className="break-all">
                            {citation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
};

export default ResultsPanel;
