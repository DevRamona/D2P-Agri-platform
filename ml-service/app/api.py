from typing import Annotated
import os

# Load .env from the ml-service root (one level up from app/)
try:
    from dotenv import load_dotenv as _load_dotenv
    import pathlib as _pathlib
    _env_path = _pathlib.Path(__file__).parent.parent / ".env"
    _load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass  # python-dotenv not installed; rely on shell environment

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from .inference import create_inference_service, create_paligemma_generation_service
except ImportError:  # pragma: no cover - allows `uvicorn api:app` from ./app
    from inference import create_inference_service, create_paligemma_generation_service


app = FastAPI(title="Crop Disease Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make the Torch classifier optional so the service can run
# with only the PaLiGemma generator when no .pth model is available.
_model_path = os.getenv("MODEL_PATH", "").strip()
inference_service = create_inference_service() if _model_path else None
paligemma_generation_service = None


def get_paligemma_generation_service():
    global paligemma_generation_service
    if paligemma_generation_service is None:
        try:
            paligemma_generation_service = create_paligemma_generation_service()
        except (MemoryError, RuntimeError) as exc:
            # OOM or CUDA out-of-memory: surface as 503 so the caller can degrade
            # gracefully instead of crashing the worker process.
            raise HTTPException(
                status_code=503,
                detail=f"PaliGemma model could not be loaded (insufficient memory or missing weights): {exc}",
            ) from exc
    return paligemma_generation_service


@app.get("/")
def read_root():
    return {
        "service": "crop-disease-inference",
        "status": "ok",
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(
    images: Annotated[list[UploadFile], File(...)],
    cropHint: Annotated[str | None, Form()] = "auto",
    mode: Annotated[str | None, Form()] = None,
):
    if inference_service is None:
        raise HTTPException(
            status_code=503,
            detail="Torch classifier model is not configured (missing MODEL_PATH). Only /generate is available.",
        )

    if len(images) == 0:
        raise HTTPException(
            status_code=400, detail="At least one image is required")
    if len(images) > 5:
        raise HTTPException(
            status_code=400, detail="Maximum 5 images are allowed")

    collected_files: list[tuple[str, bytes]] = []
    for image in images:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"File '{image.filename}' must be an image")
        content = await image.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=400, detail=f"File '{image.filename}' is empty")
        collected_files.append((image.filename or "upload.jpg", content))

    try:
        results = inference_service.predict_many(
            collected_files, crop_hint=cropHint or "auto")
        for result in results:
            result.pop("fileName", None)
            if mode:
                result["mode"] = mode
        return results
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Inference failed: {str(exc)}") from exc


@app.post("/generate")
async def generate(
    images: Annotated[list[UploadFile], File(...)],
    cropHint: Annotated[str | None, Form()] = "auto",
    mode: Annotated[str | None, Form()] = None,
):
    if len(images) == 0:
        raise HTTPException(
            status_code=400, detail="At least one image is required")
    if len(images) > 5:
        raise HTTPException(
            status_code=400, detail="Maximum 5 images are allowed")

    collected_files: list[tuple[str, bytes]] = []
    for image in images:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"File '{image.filename}' must be an image")
        content = await image.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=400, detail=f"File '{image.filename}' is empty")
        collected_files.append((image.filename or "upload.jpg", content))

    try:
        service = get_paligemma_generation_service()
        results = service.generate_many(
            collected_files, crop_hint=cropHint or "auto")
        for result in results:
            result.pop("fileName", None)
            if mode:
                result["mode"] = mode
        return results
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Generation failed: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
