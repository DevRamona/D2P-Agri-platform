import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from .inference import create_inference_service
except ImportError:  # pragma: no cover - allows `uvicorn api:app` from ./app
    from inference import create_inference_service


app = FastAPI(title="Crop Disease Inference Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

inference_service = create_inference_service()


@app.get("/")
def read_root():
    return {
        "service": "crop-disease-inference",
        "status": "ok",
        "mockModel": str(os.getenv("MOCK_MODEL", "false")).lower() in {"1", "true", "yes", "on"},
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
    if len(images) == 0:
        raise HTTPException(status_code=400, detail="At least one image is required")
    if len(images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images are allowed")

    collected_files: list[tuple[str, bytes]] = []
    for image in images:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File '{image.filename}' must be an image")
        content = await image.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail=f"File '{image.filename}' is empty")
        collected_files.append((image.filename or "upload.jpg", content))

    try:
        results = inference_service.predict_many(collected_files, crop_hint=cropHint or "auto")
        for result in results:
            result.pop("fileName", None)
            if mode:
                result["mode"] = mode
        return results
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
