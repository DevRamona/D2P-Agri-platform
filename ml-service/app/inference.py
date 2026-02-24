import hashlib
import io
import json
import os
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable

import numpy as np
from PIL import Image


MAIZE_DISEASES = ["healthy", "common_rust", "gray_leaf_spot", "northern_leaf_blight"]
BEAN_DISEASES = ["healthy", "bean_rust", "angular_leaf_spot", "anthracnose"]


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _normalize_crop_hint(crop_hint: str | None) -> str:
    normalized = (crop_hint or "auto").strip().lower()
    if normalized in {"beans", "bean"}:
        return "beans"
    if normalized == "maize":
        return "maize"
    return "auto"


def _normalize_array(image: Image.Image, size: tuple[int, int] = (224, 224)) -> np.ndarray:
    resized = image.resize(size)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    if array.ndim == 2:
        array = np.stack([array, array, array], axis=-1)
    if array.shape[-1] == 4:
        array = array[..., :3]
    return array


class BaseDiseaseModel(ABC):
    model_version: str = "unknown"

    @abstractmethod
    def load_model(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def preprocess(self, image: Image.Image) -> Any:
        raise NotImplementedError

    @abstractmethod
    def predict(
        self,
        image_tensor: Any,
        *,
        crop_hint: str = "auto",
        raw_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError


class MockDiseaseModel(BaseDiseaseModel):
    model_version = "mock-v1"

    def load_model(self) -> None:
        return None

    def preprocess(self, image: Image.Image) -> np.ndarray:
        return _normalize_array(image)

    def predict(
        self,
        image_tensor: np.ndarray,
        *,
        crop_hint: str = "auto",
        raw_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        digest = hashlib.sha256(raw_bytes or image_tensor.tobytes()).hexdigest()
        seed = int(digest[:16], 16)

        mean_green = float(image_tensor[..., 1].mean())
        contrast = float(image_tensor.std())
        normalized_hint = _normalize_crop_hint(crop_hint)

        if normalized_hint == "auto":
            crop_type = "maize" if (seed % 2 == 0) else "bean"
        else:
            crop_type = "bean" if normalized_hint == "beans" else normalized_hint

        disease_options = MAIZE_DISEASES if crop_type == "maize" else BEAN_DISEASES

        if mean_green > 0.45 and contrast < 0.22:
            disease = "healthy"
        else:
            disease = disease_options[seed % len(disease_options)]

        confidence_base = 0.55 + ((seed % 30) / 100.0)  # 0.55 - 0.84
        confidence_adjustment = min(0.12, max(-0.1, (contrast - 0.18)))
        confidence = float(np.clip(confidence_base + confidence_adjustment, 0.51, 0.94))

        return {
            "cropType": crop_type,
            "disease": disease,
            "confidence": confidence,
        }


class TorchDiseaseModel(BaseDiseaseModel):
    def __init__(self, model_path: str | None = None, labels: list[str] | None = None):
        self.model_path = model_path or os.getenv("MODEL_PATH")
        self.labels = labels or [label.strip() for label in os.getenv("MODEL_LABELS", "").split(",") if label.strip()]
        self.device = os.getenv("MODEL_DEVICE", "cpu")
        self.model_format = (os.getenv("MODEL_FORMAT") or "").strip().lower()
        self._torch = None
        self._model = None
        self._inference_transform = None
        self._model_backend = "torchscript"
        self._available_crops: set[str] = set()
        self.model_version = os.getenv("MODEL_VERSION", "torch-generic-v1")

    def _metadata_label_candidates(self) -> list[str]:
        if not self.model_path:
            return []
        model_path = str(self.model_path)
        root, _ = os.path.splitext(model_path)
        return [f"{root}.labels.json", f"{model_path}.labels.json"]

    def _load_labels_from_sidecar(self) -> None:
        if self.labels:
            return

        for candidate in self._metadata_label_candidates():
            if not os.path.exists(candidate):
                continue

            try:
                with open(candidate, "r", encoding="utf-8") as handle:
                    metadata = json.load(handle)
            except Exception:
                continue

            labels = metadata.get("labels")
            if isinstance(labels, list) and all(isinstance(label, str) for label in labels):
                self.labels = [label.strip() for label in labels if str(label).strip()]
            else:
                class_names = metadata.get("class_names")
                crop_type = str(metadata.get("crop_type") or "").strip().lower()
                if isinstance(class_names, list) and crop_type in {"bean", "maize"}:
                    normalized_class_names = [str(name).strip() for name in class_names if str(name).strip()]
                    self.labels = [f"{crop_type}:{name}" for name in normalized_class_names]

            if self.labels and self.model_version == "torch-generic-v1":
                metadata_version = str(metadata.get("model_version") or "").strip()
                if metadata_version:
                    self.model_version = metadata_version
            if self.labels:
                return

    def _infer_default_labels_if_missing(self) -> None:
        if self.labels:
            return
        if not self.model_path:
            return
        if not str(self.model_path).lower().endswith(".pth"):
            return

        # Convenience fallback for the existing repository bean model.
        try:
            from model.dataset import CLASS_NAMES  # type: ignore

            self.labels = [f"bean:{label}" for label in CLASS_NAMES]
            if self.model_version == "torch-generic-v1":
                self.model_version = "bean-state-dict-v1"
        except Exception:
            # Keep strict validation behavior if the import is unavailable.
            return

    def _validate_labels(self) -> None:
        if not self.labels:
            raise RuntimeError("MODEL_LABELS is required when MOCK_MODEL=false (format: crop:disease,crop:disease,...)")

        available_crops: set[str] = set()
        for label in self.labels:
            if ":" not in label:
                raise RuntimeError(
                    "Each MODEL_LABELS entry must be in the format crop:disease (e.g. maize:common_rust)",
                )
            crop_name, _ = label.split(":", 1)
            if crop_name not in {"maize", "bean", "beans"}:
                raise RuntimeError("Only bean/beans and maize crops are supported in MODEL_LABELS")
            available_crops.add("bean" if crop_name in {"bean", "beans"} else "maize")

        self._available_crops = available_crops

    def _load_torchscript(self) -> None:
        self._model = self._torch.jit.load(self.model_path, map_location=self.device)
        self._model.eval()
        self._model_backend = "torchscript"

    def _load_state_dict(self) -> None:
        from model.model import get_model  # type: ignore

        try:
            from model.dataset import get_transforms  # type: ignore
        except Exception:
            get_transforms = None

        state = self._torch.load(self.model_path, map_location=self.device)
        if isinstance(state, dict) and "state_dict" in state and isinstance(state["state_dict"], dict):
            state = state["state_dict"]

        if not isinstance(state, dict):
            raise RuntimeError("Unsupported .pth file format. Expected a PyTorch state_dict.")

        # Handle DataParallel checkpoints (module.* keys).
        if any(str(key).startswith("module.") for key in state.keys()):
            state = {str(key).replace("module.", "", 1): value for key, value in state.items()}

        model = get_model(num_classes=len(self.labels), pretrained=False)
        model.load_state_dict(state, strict=True)
        model.to(self.device)
        model.eval()

        self._model = model
        self._model_backend = "state_dict"
        if get_transforms is not None:
            self._inference_transform = get_transforms(is_train=False)

    def load_model(self) -> None:
        if not self.model_path:
            raise RuntimeError("MODEL_PATH is required when MOCK_MODEL=false")
        self._load_labels_from_sidecar()
        self._infer_default_labels_if_missing()
        self._validate_labels()

        import torch

        self._torch = torch

        path_lower = str(self.model_path).lower()
        should_load_state_dict = self.model_format == "state_dict" or (
            self.model_format != "torchscript" and path_lower.endswith(".pth")
        )

        if should_load_state_dict:
            self._load_state_dict()
            if self.model_version == "torch-generic-v1":
                self.model_version = "torch-state-dict-v1"
            return

        self._load_torchscript()

    def preprocess(self, image: Image.Image):
        if self._torch is None:
            # load_model() should have been called, but keep a safe failure mode.
            raise RuntimeError("Torch model is not initialized")

        if self._model_backend == "state_dict" and self._inference_transform is not None:
            return self._inference_transform(image).unsqueeze(0)

        array = _normalize_array(image)
        chw = np.transpose(array, (2, 0, 1))
        tensor = self._torch.tensor(chw, dtype=self._torch.float32).unsqueeze(0)
        return tensor

    def predict(
        self,
        image_tensor,
        *,
        crop_hint: str = "auto",
        raw_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        if self._model is None or self._torch is None:
            raise RuntimeError("Torch model is not initialized")

        if hasattr(image_tensor, "to"):
            image_tensor = image_tensor.to(self.device)

        with self._torch.no_grad():
            logits = self._model(image_tensor)
            if isinstance(logits, (tuple, list)):
                logits = logits[0]
            logits_row = logits[0]
            normalized_hint = _normalize_crop_hint(crop_hint)
            allowed_indices = None

            if normalized_hint in {"beans", "maize"} and self.labels:
                normalized_crop = "bean" if normalized_hint == "beans" else normalized_hint
                matching_indices = []
                for idx, raw_label in enumerate(self.labels):
                    if ":" not in raw_label:
                        continue
                    label_crop, _ = raw_label.split(":", 1)
                    if label_crop in {"bean", "beans"}:
                        label_crop = "bean"
                    if label_crop == normalized_crop:
                        matching_indices.append(idx)

                if matching_indices:
                    allowed_indices = matching_indices

            if allowed_indices:
                cropped_logits = logits_row[allowed_indices]
                probabilities = self._torch.softmax(cropped_logits, dim=-1)
                confidence, local_index = self._torch.max(probabilities, dim=0)
                index = allowed_indices[int(local_index.item())]
            else:
                probabilities = self._torch.softmax(logits_row, dim=-1)
                confidence, index = self._torch.max(probabilities, dim=0)

        label = self.labels[int(index)]
        crop_type, disease = label.split(":", 1)
        if crop_type in {"beans", "bean"}:
            crop_type = "bean"

        return {
            "cropType": crop_type,
            "disease": disease,
            "confidence": float(confidence.item()),
        }


@dataclass
class ImageQualityReport:
    warnings: list[str]
    brightness_mean: float
    blur_score: float


class ImageQualityChecker:
    def __init__(self, brightness_threshold: float = 40.0, blur_threshold: float = 8.0):
        self.brightness_threshold = brightness_threshold
        self.blur_threshold = blur_threshold

    def assess(self, image: Image.Image) -> ImageQualityReport:
        rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
        gray = (0.299 * rgb[..., 0]) + (0.587 * rgb[..., 1]) + (0.114 * rgb[..., 2])
        brightness_mean = float(gray.mean())

        gx = np.diff(gray, axis=1)
        gy = np.diff(gray, axis=0)
        blur_score = float(np.var(gx) + np.var(gy))

        warnings: list[str] = []
        if brightness_mean < self.brightness_threshold:
            warnings.append("Image appears too dark. Retake in better lighting.")
        if blur_score < self.blur_threshold:
            warnings.append("Image may be blurry. Hold camera steady and refocus.")

        return ImageQualityReport(warnings=warnings, brightness_mean=brightness_mean, blur_score=blur_score)


class DiseaseInferenceService:
    def __init__(self, model: BaseDiseaseModel | None = None):
        self.mock_mode = _as_bool(os.getenv("MOCK_MODEL"), default=False)
        self.model = model or (MockDiseaseModel() if self.mock_mode else TorchDiseaseModel())
        self.quality_checker = ImageQualityChecker()
        self.model.load_model()

    def _open_image(self, raw_bytes: bytes) -> Image.Image:
        return Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    def predict_bytes(self, raw_bytes: bytes, *, filename: str, crop_hint: str = "auto") -> dict[str, Any]:
        started = time.perf_counter()
        image = self._open_image(raw_bytes)
        quality = self.quality_checker.assess(image)
        image_tensor = self.model.preprocess(image)
        prediction = self.model.predict(image_tensor, crop_hint=crop_hint, raw_bytes=raw_bytes)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)

        return {
            "imageId": str(uuid.uuid4()),
            "cropType": prediction.get("cropType", "unknown"),
            "disease": prediction.get("disease", "unknown"),
            "confidence": float(prediction.get("confidence", 0.0)),
            "modelVersion": self.model.model_version,
            "latencyMs": latency_ms,
            "warnings": quality.warnings,
            "fileName": filename,
        }

    def predict_many(self, files: Iterable[tuple[str, bytes]], *, crop_hint: str = "auto") -> list[dict[str, Any]]:
        normalized_crop_hint = _normalize_crop_hint(crop_hint)
        return [
            self.predict_bytes(raw_bytes, filename=filename, crop_hint=normalized_crop_hint)
            for filename, raw_bytes in files
        ]


def create_inference_service() -> DiseaseInferenceService:
    return DiseaseInferenceService()
