import { useEffect, useRef, useState } from "react";
import type { AnalyzeMode } from "../../api/disease";

type SelectedUpload = {
  id: string;
  file: File;
  previewUrl: string;
};

type UploadAnalyzerProps = {
  onAnalyze: (images: File[], mode: AnalyzeMode) => Promise<void>;
  isAnalyzing: boolean;
  maxImages?: number;
};

const isValidImageType = (file: File) => ["image/png", "image/jpeg", "image/jpg"].includes(file.type);

const createLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const UploadAnalyzer = ({ onAnalyze, isAnalyzing, maxImages = 5 }: UploadAnalyzerProps) => {
  const [selectedImages, setSelectedImages] = useState<SelectedUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const selectedImagesRef = useRef<SelectedUpload[]>([]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  const addFiles = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) {
      return;
    }

    setError(null);
    setSelectedImages((current) => {
      const next = [...current];

      for (const file of Array.from(incomingFiles)) {
        if (!isValidImageType(file)) {
          setError("Only PNG and JPG images are supported.");
          continue;
        }

        if (next.length >= maxImages) {
          setError(`Maximum ${maxImages} images are allowed per analysis.`);
          break;
        }

        next.push({
          id: createLocalId(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      return next;
    });
  };

  const removeImage = (id: string) => {
    setSelectedImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  };

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) {
      setError("Select at least one image to analyze.");
      return;
    }

    await onAnalyze(
      selectedImages.map((image) => image.file),
      "upload",
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-[var(--stroke)] bg-[var(--surface)] p-4">
        <label
          htmlFor="disease-upload-input"
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-[var(--surface-2)] px-4 py-8 text-center"
        >
          <span className="text-sm font-semibold">Select leaf images (PNG/JPG)</span>
          <span className="mt-2 text-xs text-[var(--muted)]">Upload up to {maxImages} photos, max 5MB each.</span>
          <span className="mt-4 rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold">
            Choose Images
          </span>
        </label>
        <input
          id="disease-upload-input"
          type="file"
          accept="image/png,image/jpeg"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {error && <div className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {selectedImages.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {selectedImages.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--surface)]">
                <img src={image.previewUrl} alt={image.file.name} className="h-28 w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-2">
                  <p className="m-0 min-w-0 flex-1 truncate text-xs">{image.file.name}</p>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="rounded-md border border-[var(--stroke)] px-2 py-1 text-xs font-semibold"
                    aria-label={`Remove ${image.file.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : `Analyze ${selectedImages.length} image${selectedImages.length > 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </div>
  );
};

export default UploadAnalyzer;
