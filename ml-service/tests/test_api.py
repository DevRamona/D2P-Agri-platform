import io
from typing import Any
from unittest.mock import patch

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from app.inference import BaseDiseaseModel, DiseaseInferenceService


class StubDiseaseModel(BaseDiseaseModel):
    """Minimal in-process stub used only in tests — no file I/O, no PyTorch."""

    model_version = "stub-v1"

    def load_model(self) -> None:
        return None

    def preprocess(self, image: Image.Image) -> np.ndarray:
        arr = np.asarray(image.resize((224, 224)), dtype=np.float32) / 255.0
        return arr

    def predict(
        self,
        image_tensor: Any,
        *,
        crop_hint: str = "auto",
        raw_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        return {"cropType": "maize", "disease": "healthy", "confidence": 0.92}


_stub_service = DiseaseInferenceService(model=StubDiseaseModel())

from app.api import app  # noqa: E402

with patch("app.api.inference_service", _stub_service):
    client = TestClient(app)


def _make_image_bytes(color: tuple[int, int, int]) -> bytes:
    image = Image.new("RGB", (64, 64), color=color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_predict_returns_array_for_multiple_images():
    files = [
        ("images", ("leaf-1.jpg", _make_image_bytes((30, 140, 30)), "image/jpeg")),
        ("images", ("leaf-2.jpg", _make_image_bytes((100, 80, 40)), "image/jpeg")),
    ]

    response = client.post(
        "/predict",
        files=files,
        data={"cropHint": "auto", "mode": "upload"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 2

    for item in payload:
        assert "imageId" in item
        assert "cropType" in item
        assert "disease" in item
        assert "confidence" in item
        assert "modelVersion" in item
        assert "latencyMs" in item
        assert isinstance(item.get("warnings", []), list)
