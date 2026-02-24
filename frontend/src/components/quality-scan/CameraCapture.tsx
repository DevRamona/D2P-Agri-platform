import { useEffect, useRef, useState } from "react";
import type { AnalyzeMode } from "../../api/disease";

type CameraCaptureProps = {
  onAnalyze: (images: File[], mode: AnalyzeMode) => Promise<void>;
  isAnalyzing: boolean;
  liveModeAvailable?: boolean;
};

const MAX_FRAME_WIDTH = 1280;
const MAX_FRAME_HEIGHT = 960;

const CameraCapture = ({ onAnalyze, isAnalyzing, liveModeAvailable = true }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  const capturedFileRef = useRef<File | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [liveModeEnabled, setLiveModeEnabled] = useState(false);
  const [liveModeRunning, setLiveModeRunning] = useState(false);
  const [liveIntervalSeconds, setLiveIntervalSeconds] = useState(2);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  useEffect(() => {
    capturedFileRef.current = capturedFile;
  }, [capturedFile]);

  const stopStream = () => {
    if (liveTimerRef.current !== null) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
      setLiveModeRunning(false);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  useEffect(() => () => stopStream(), []);

  const startCamera = async () => {
    setCameraError(null);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser settings and try again."
          : "Unable to start the camera. Check camera availability and browser permissions.";
      setCameraError(message);
      stopStream();
    }
  };

  const captureFrameToFile = async (filenamePrefix: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Camera is not ready yet. Wait for the video feed to load.");
    }

    const widthRatio = MAX_FRAME_WIDTH / video.videoWidth;
    const heightRatio = MAX_FRAME_HEIGHT / video.videoHeight;
    const ratio = Math.min(1, widthRatio, heightRatio);
    const width = Math.max(1, Math.round(video.videoWidth * ratio));
    const height = Math.max(1, Math.round(video.videoHeight * ratio));

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to access capture canvas.");
    }

    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Could not capture image from camera."));
            return;
          }
          resolve(result);
        },
        "image/jpeg",
        0.9,
      );
    });

    const file = new File([blob], `${filenamePrefix}-${Date.now()}.jpg`, { type: "image/jpeg" });
    return { file, dataUrl };
  };

  const handleCapture = async () => {
    try {
      const { file, dataUrl } = await captureFrameToFile("camera-capture");
      setCapturedFile(file);
      setCapturedPreview(dataUrl);
      setCameraError(null);
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Failed to capture image.");
    }
  };

  const handleAnalyzeCaptured = async () => {
    if (!capturedFile) {
      setCameraError("Capture an image first before analyzing.");
      return;
    }
    await onAnalyze([capturedFile], "camera");
  };

  const stopLiveMode = () => {
    if (liveTimerRef.current !== null) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveModeRunning(false);
  };

  const startLiveMode = async () => {
    if (!cameraActive) {
      await startCamera();
    }
    if (!streamRef.current) {
      return;
    }

    stopLiveMode();

    const intervalMs = Math.max(1, liveIntervalSeconds) * 1000;
    liveTimerRef.current = window.setInterval(async () => {
      if (isAnalyzingRef.current || !streamRef.current || capturedFileRef.current) {
        return;
      }

      try {
        const { file } = await captureFrameToFile("live-frame");
        await onAnalyze([file], "live");
      } catch (error) {
        setCameraError(error instanceof Error ? error.message : "Live mode capture failed.");
        stopLiveMode();
      }
    }, intervalMs);

    setLiveModeRunning(true);
  };

  const handleRetake = () => {
    setCapturedFile(null);
    setCapturedPreview(null);
    setCameraError(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--stroke)] bg-black">
        {capturedPreview ? (
          <img src={capturedPreview} alt="Captured leaf preview" className="h-72 w-full object-cover sm:h-80" />
        ) : (
          <div className="relative h-72 w-full sm:h-80">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
            {!cameraActive && (
              <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(180deg,#0f1713,#18251d)] p-6 text-center">
                <div>
                  <p className="m-0 text-sm font-semibold text-white">Camera is off</p>
                  <p className="m-0 mt-2 text-xs text-white/70">
                    Start the camera to scan maize or bean leaves using your device webcam.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/35">
          <span className="absolute left-0 top-0 h-7 w-7 border-l-2 border-t-2 border-[var(--accent)]" />
          <span className="absolute right-0 top-0 h-7 w-7 border-r-2 border-t-2 border-[var(--accent)]" />
          <span className="absolute bottom-0 left-0 h-7 w-7 border-b-2 border-l-2 border-[var(--accent)]" />
          <span className="absolute bottom-0 right-0 h-7 w-7 border-b-2 border-r-2 border-[var(--accent)]" />
        </div>
      </div>

      {cameraError && (
        <div className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {cameraError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          onClick={startCamera}
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-3 text-sm font-semibold"
        >
          Start Camera
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!cameraActive || isAnalyzing}
          className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[#0b1307] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Capture
        </button>
        <button
          type="button"
          onClick={handleRetake}
          disabled={!capturedFile || isAnalyzing}
          className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={handleAnalyzeCaptured}
          disabled={!capturedFile || isAnalyzing}
          className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {liveModeAvailable && (
        <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={liveModeEnabled}
                onChange={(event) => {
                  setLiveModeEnabled(event.target.checked);
                  if (!event.target.checked) {
                    stopLiveMode();
                  }
                }}
              />
              Optional live mode (off by default)
            </label>

            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="live-interval">Every</label>
              <input
                id="live-interval"
                type="number"
                min={1}
                max={10}
                value={liveIntervalSeconds}
                onChange={(event) => setLiveIntervalSeconds(Number(event.target.value || 2))}
                className="w-16 rounded-md border border-[var(--stroke)] bg-[var(--surface-2)] px-2 py-1"
                disabled={!liveModeEnabled}
              />
              <span>sec</span>
            </div>
          </div>

          {liveModeEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={startLiveMode}
                disabled={liveModeRunning || isAnalyzing}
                className="rounded-xl border border-[var(--stroke)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Live
              </button>
              <button
                type="button"
                onClick={stopLiveMode}
                disabled={!liveModeRunning}
                className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Stop
              </button>
              <span className="text-xs text-[var(--muted)]">
                {liveModeRunning ? "Sending one frame at each interval." : "Live mode is ready but paused."}
              </span>
            </div>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
