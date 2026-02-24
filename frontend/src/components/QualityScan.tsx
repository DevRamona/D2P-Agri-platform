import { useEffect, useRef, useState } from "react";
import type { ViewMode } from "../types";
import {
  analyzeDiseaseImages,
  type CropHint,
  type DiseaseAnalysisResult,
  type RecommendationLanguage,
} from "../api/disease";
import CameraCapture from "./quality-scan/CameraCapture";
import UploadAnalyzer from "./quality-scan/UploadAnalyzer";
import ResultsPanel from "./quality-scan/ResultsPanel";

interface QualityScanProps {
  onNavigate?: (view: ViewMode) => void;
}

type ScanTab = "camera" | "upload";

const QualityScan = ({ onNavigate }: QualityScanProps) => {
  const [activeTab, setActiveTab] = useState<ScanTab>("camera");
  const [cropHint, setCropHint] = useState<CropHint>("auto");
  const [language, setLanguage] = useState<RecommendationLanguage>("en");
  const [results, setResults] = useState<DiseaseAnalysisResult[]>([]);
  const [previewByImageId, setPreviewByImageId] = useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<string | null>(null);
  const previewUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    previewUrlsRef.current = previewByImageId;
  }, [previewByImageId]);

  useEffect(
    () => () => {
      Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const handleAnalyze = async (images: File[], mode: "camera" | "upload" | "live") => {
    if (images.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    setRequestError(null);
    setLastMode(mode);

    try {
      const nextResults = await analyzeDiseaseImages({
        images,
        cropHint,
        mode,
      });

      const newPreviews: Record<string, string> = {};
      nextResults.forEach((result, index) => {
        const file = images[index];
        if (file) {
          newPreviews[result.imageId] = URL.createObjectURL(file);
        }
      });

      setPreviewByImageId((current) => {
        if (mode !== "live") {
          Object.values(current).forEach((url) => URL.revokeObjectURL(url));
          return newPreviews;
        }

        const merged = { ...current, ...newPreviews };
        const orderedIds = [...nextResults.map((item) => item.imageId), ...Object.keys(current)];
        const cappedIds = orderedIds.filter((id, idx, arr) => arr.indexOf(id) === idx).slice(0, 10);
        Object.keys(merged).forEach((id) => {
          if (!cappedIds.includes(id)) {
            URL.revokeObjectURL(merged[id]);
            delete merged[id];
          }
        });
        return merged;
      });

      setResults((current) => {
        if (mode !== "live") {
          return nextResults;
        }
        const merged = [...nextResults, ...current];
        const uniqueById = new Map<string, DiseaseAnalysisResult>();
        for (const item of merged) {
          if (!uniqueById.has(item.imageId)) {
            uniqueById.set(item.imageId, item);
          }
        }
        return Array.from(uniqueById.values()).slice(0, 10);
      });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Analysis request failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="w-full max-w-[700px] animate-[rise_0.6s_ease_both] pb-8">
      <div className="rounded-[28px] border border-[var(--stroke)] bg-[linear-gradient(180deg,var(--surface),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow)]">
        <header className="flex items-start justify-between gap-4">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--stroke)] bg-[var(--surface-2)]"
            onClick={() => onNavigate?.("dashboard")}
            aria-label="Go back"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="flex-1">
            <p className="m-0 text-xs font-semibold tracking-[2px] text-[var(--muted)]">QUALITY SCAN</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold">Crop Disease Scanner</h1>
            <p className="m-0 mt-2 text-sm text-[var(--muted)]">
              Scan maize or bean leaves using your webcam or uploaded images, then request LLM recommendations.
            </p>
          </div>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="m-0 text-xs font-semibold tracking-[1px] text-[var(--muted)]">Input Mode</p>
            <div className="mt-2 inline-flex rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] p-1">
              <button
                type="button"
                onClick={() => setActiveTab("camera")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  activeTab === "camera" ? "bg-[var(--accent)] text-[#0b1307]" : "text-[var(--text)]"
                }`}
              >
                Use Camera
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  activeTab === "upload" ? "bg-[var(--accent)] text-[#0b1307]" : "text-[var(--text)]"
                }`}
              >
                Upload Images
              </button>
            </div>
          </div>

          <div>
            <p className="m-0 text-xs font-semibold tracking-[1px] text-[var(--muted)]">Crop Hint</p>
            <div className="mt-2 inline-flex rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] p-1">
              {[
                { label: "Auto", value: "auto" },
                { label: "Maize", value: "maize" },
                { label: "Beans", value: "beans" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCropHint(option.value as CropHint)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    cropHint === option.value ? "bg-[var(--surface)]" : "text-[var(--muted)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {activeTab === "camera" ? (
            <CameraCapture onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          ) : (
            <UploadAnalyzer onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="m-0 text-sm font-semibold">Analysis Status</p>
              <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                {isAnalyzing
                  ? "Sending image(s) to disease inference service..."
                  : lastMode
                    ? `Last run completed via ${lastMode} mode.`
                    : "Ready to analyze leaf images."}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
                isAnalyzing ? "bg-amber-500/10 text-amber-200" : "bg-emerald-500/10 text-emerald-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-amber-300" : "bg-emerald-300"}`} />
              {isAnalyzing ? "Analyzing" : "Idle"}
            </span>
          </div>

          {requestError && (
            <div className="mt-3 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {requestError}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <ResultsPanel
          results={results}
          previewByImageId={previewByImageId}
          language={language}
          onLanguageChange={setLanguage}
        />
      </div>
    </section>
  );
};

export default QualityScan;
