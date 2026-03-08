import io
from typing import Any
from unittest.mock import patch

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient

from app.inference import BaseDiseaseModel, DiseaseInferenceService


class StubDiseaseModel(BaseDiseaseModel):
    """Minimal in-process stub used only in tests: no file I/O, no PyTorch."""

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


class StubGenerationService:
    def generate_many(self, files, *, crop_hint: str = "auto"):
        return [
            {
                "imageId": f"gen-{idx + 1}",
                "cropType": "bean",
                "disease": "bean_rust",
                "candidateDisease": "bean_rust",
                "diagnosis": "Bean Rust",
                "recommendation": "Remove heavily infected leaves and use resistant varieties.",
                "generatedText": "Disease: Bean Rust. Advice: Remove heavily infected leaves and use resistant varieties.",
                "confidence": 0.0,
                "isUncertain": False,
                "uncertaintyReasons": [],
                "modelVersion": "paligemma-rwanda-lora-v1",
                "latencyMs": 42.0,
                "warnings": [],
            }
            for idx, _ in enumerate(files)
        ]


_stub_generation_service = StubGenerationService()

with patch("app.inference.create_inference_service", return_value=_stub_service), patch(
    "app.inference.create_paligemma_generation_service",
    return_value=_stub_generation_service,
):
    from app.api import app  # noqa: E402

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


def test_generate_returns_diagnosis_and_recommendation():
    files = [
        ("images", ("leaf-1.jpg", _make_image_bytes((20, 120, 40)), "image/jpeg")),
    ]

    response = client.post(
        "/generate",
        files=files,
        data={"cropHint": "beans", "mode": "upload"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
    item = payload[0]
    assert item["disease"] == "bean_rust"
    assert "diagnosis" in item
    assert "recommendation" in item
    assert "generatedText" in item
