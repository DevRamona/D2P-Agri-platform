import io
import os

from PIL import Image
from fastapi.testclient import TestClient

os.environ["MOCK_MODEL"] = "true"

from app.api import app  


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
