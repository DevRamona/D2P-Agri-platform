import io
import json
import os
import re
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Iterable

import numpy as np
from PIL import Image


def _coerce_float(value, default):
    try:
        return float(value)
    except Exception:
        return float(default)


def _normalize_crop_name(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"bean", "beans"}:
        return "bean"
    if normalized in {"maize", "corn"}:
        return "maize"
    return normalized


def _split_label(label: str) -> tuple[str, str]:
    if ":" in str(label):
        crop_name, disease_name = str(label).split(":", 1)
        return _normalize_crop_name(crop_name), str(disease_name).strip().lower()
    return "unknown", str(label).strip().lower()


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


class TorchDiseaseModel(BaseDiseaseModel):
    def __init__(self, model_path: str | None = None, labels: list[str] | None = None):
        self.model_path = model_path or os.getenv("MODEL_PATH")
        self.labels = labels or [label.strip() for label in os.getenv(
            "MODEL_LABELS", "").split(",") if label.strip()]
        self.device = os.getenv("MODEL_DEVICE", "cpu")
        self.model_format = (os.getenv("MODEL_FORMAT") or "").strip().lower()
        self._torch = None
        self._model = None
        self._inference_transform = None
        self._model_backend = "torchscript"
        self._available_crops: set[str] = set()
        self.model_version = os.getenv("MODEL_VERSION", "torch-generic-v1")
        self._confidence_threshold_by_label: dict[str, float] = {}
        self._confidence_threshold_by_crop: dict[str, float] = {}
        self._default_confidence_threshold = _coerce_float(
            os.getenv("MODEL_DEFAULT_CONFIDENCE_THRESHOLD"),
            0.65,
        )
        self._margin_threshold = _coerce_float(
            os.getenv("MODEL_MARGIN_THRESHOLD"), 0.08)
        self._uncertain_label = os.getenv(
            "MODEL_UNCERTAIN_LABEL", "uncertain").strip().lower() or "uncertain"

    def _metadata_label_candidates(self) -> list[str]:
        if not self.model_path:
            return []
        model_path = str(self.model_path)
        root, _ = os.path.splitext(model_path)
        return [f"{root}.labels.json", f"{model_path}.labels.json"]

    def _read_calibration_metadata(self, metadata: dict[str, Any]) -> None:
        calibration = metadata.get("calibration")
        if not isinstance(calibration, dict):
            return

        by_label = calibration.get("confidence_threshold_by_label") or {}
        by_crop = calibration.get("confidence_threshold_by_crop") or {}
        if isinstance(by_label, dict):
            self._confidence_threshold_by_label = {
                str(label): _coerce_float(threshold, self._default_confidence_threshold)
                for label, threshold in by_label.items()
            }
        if isinstance(by_crop, dict):
            self._confidence_threshold_by_crop = {
                _normalize_crop_name(crop): _coerce_float(threshold, self._default_confidence_threshold)
                for crop, threshold in by_crop.items()
            }

        self._default_confidence_threshold = _coerce_float(
            calibration.get("default_confidence_threshold"),
            self._default_confidence_threshold,
        )
        self._margin_threshold = _coerce_float(
            calibration.get("margin_threshold"), self._margin_threshold)

    def _load_labels_from_sidecar(self) -> None:
        for candidate in self._metadata_label_candidates():
            if not os.path.exists(candidate):
                continue

            try:
                with open(candidate, "r", encoding="utf-8") as handle:
                    metadata = json.load(handle)
            except Exception:
                continue

            if not self.labels:
                labels = metadata.get("labels")
                if isinstance(labels, list) and all(isinstance(label, str) for label in labels):
                    self.labels = [label.strip()
                                   for label in labels if str(label).strip()]
                else:
                    class_names = metadata.get("class_names")
                    crop_type = str(metadata.get("crop_type")
                                    or "").strip().lower()
                    if isinstance(class_names, list) and crop_type in {"bean", "maize"}:
                        normalized_class_names = [
                            str(name).strip() for name in class_names if str(name).strip()]
                        self.labels = [
                            f"{crop_type}:{name}" for name in normalized_class_names]

            if self.labels and self.model_version == "torch-generic-v1":
                metadata_version = str(metadata.get(
                    "model_version") or "").strip()
                if metadata_version:
                    self.model_version = metadata_version

            self._read_calibration_metadata(metadata)
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
            raise RuntimeError(
                "MODEL_LABELS is required (format: crop:disease,crop:disease,...) e.g. maize:healthy,maize:common_rust")

        available_crops: set[str] = set()
        for label in self.labels:
            if ":" not in label:
                raise RuntimeError(
                    "Each MODEL_LABELS entry must be in the format crop:disease (e.g. maize:common_rust)",
                )
            crop_name, _ = label.split(":", 1)
            if crop_name not in {"maize", "bean", "beans"}:
                raise RuntimeError(
                    "Only bean/beans and maize crops are supported in MODEL_LABELS")
            available_crops.add("bean" if crop_name in {
                                "bean", "beans"} else "maize")

        self._available_crops = available_crops

    def _threshold_for_label(self, label: str) -> float:
        crop_name, _ = _split_label(label)
        by_label = self._confidence_threshold_by_label.get(label)
        if by_label is not None:
            return float(by_label)

        by_crop = self._confidence_threshold_by_crop.get(crop_name)
        if by_crop is not None:
            return float(by_crop)
        return float(self._default_confidence_threshold)

    def _prediction_entry(self, label_index: int, probability: float) -> dict[str, Any]:
        label = self.labels[int(label_index)]
        crop_name, disease_name = _split_label(label)
        return {
            "cropType": crop_name,
            "disease": disease_name,
            "confidence": float(probability),
            "label": label,
        }

    def _load_torchscript(self) -> None:
        self._model = self._torch.jit.load(
            self.model_path, map_location=self.device)
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
            raise RuntimeError(
                "Unsupported .pth file format. Expected a PyTorch state_dict.")

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
            raise RuntimeError(
                "MODEL_PATH is required - set it to the path of your trained .pth model file")
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
        tensor = self._torch.tensor(
            chw, dtype=self._torch.float32).unsqueeze(0)
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
                top_k = min(3, probabilities.shape[0])
                top_values, local_top_indices = self._torch.topk(
                    probabilities, k=top_k)
                prediction_indices = [
                    allowed_indices[int(local_idx.item())] for local_idx in local_top_indices]
            else:
                probabilities = self._torch.softmax(logits_row, dim=-1)
                top_k = min(3, probabilities.shape[0])
                top_values, top_indices = self._torch.topk(
                    probabilities, k=top_k)
                prediction_indices = [int(index.item())
                                      for index in top_indices]

        top_predictions = [
            self._prediction_entry(
                label_index=index, probability=float(probability.item()))
            for index, probability in zip(prediction_indices, top_values)
        ]

        if not top_predictions:
            return {
                "cropType": "unknown",
                "disease": self._uncertain_label,
                "candidateDisease": "unknown",
                "confidence": 0.0,
                "isUncertain": True,
                "uncertaintyReasons": ["Model returned no predictions."],
                "thresholdApplied": float(self._default_confidence_threshold),
                "margin": 0.0,
                "marginThreshold": float(self._margin_threshold),
                "topPredictions": [],
            }

        best_prediction = top_predictions[0]
        confidence = float(best_prediction["confidence"])
        crop_type = str(best_prediction["cropType"])
        candidate_disease = str(best_prediction["disease"])
        label = str(best_prediction["label"])
        threshold = self._threshold_for_label(label)
        second_conf = float(top_predictions[1]["confidence"]) if len(
            top_predictions) > 1 else 0.0
        margin = confidence - second_conf

        reasons = []
        if confidence < threshold:
            reasons.append(
                f"Confidence {round(confidence, 4)} is below threshold {round(threshold, 4)} for {label}.",
            )
        if len(top_predictions) > 1 and margin < self._margin_threshold:
            reasons.append(
                f"Top prediction margin {round(margin, 4)} is below minimum {round(self._margin_threshold, 4)}.",
            )

        is_uncertain = len(reasons) > 0
        disease = self._uncertain_label if is_uncertain else candidate_disease

        return {
            "cropType": crop_type,
            "disease": disease,
            "candidateDisease": candidate_disease,
            "confidence": confidence,
            "isUncertain": is_uncertain,
            "uncertaintyReasons": reasons,
            "thresholdApplied": float(threshold),
            "margin": float(margin),
            "marginThreshold": float(self._margin_threshold),
            "topPredictions": top_predictions,
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
        gray = (0.299 * rgb[..., 0]) + \
            (0.587 * rgb[..., 1]) + (0.114 * rgb[..., 2])
        brightness_mean = float(gray.mean())

        gx = np.diff(gray, axis=1)
        gy = np.diff(gray, axis=0)
        blur_score = float(np.var(gx) + np.var(gy))

        warnings: list[str] = []
        if brightness_mean < self.brightness_threshold:
            warnings.append(
                "Image appears too dark. Retake in better lighting.")
        if blur_score < self.blur_threshold:
            warnings.append(
                "Image may be blurry. Hold camera steady and refocus.")

        return ImageQualityReport(warnings=warnings, brightness_mean=brightness_mean, blur_score=blur_score)


class DiseaseInferenceService:
    def __init__(self, model: BaseDiseaseModel | None = None):
        self.model = model or TorchDiseaseModel()
        self.quality_checker = ImageQualityChecker()
        self.model.load_model()

    def _open_image(self, raw_bytes: bytes) -> Image.Image:
        return Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    def predict_bytes(self, raw_bytes: bytes, *, filename: str, crop_hint: str = "auto") -> dict[str, Any]:
        started = time.perf_counter()
        image = self._open_image(raw_bytes)
        quality = self.quality_checker.assess(image)
        image_tensor = self.model.preprocess(image)
        prediction = self.model.predict(
            image_tensor, crop_hint=crop_hint, raw_bytes=raw_bytes)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)

        return {
            "imageId": str(uuid.uuid4()),
            "cropType": prediction.get("cropType", "unknown"),
            "disease": prediction.get("disease", "unknown"),
            "candidateDisease": prediction.get("candidateDisease"),
            "confidence": float(prediction.get("confidence", 0.0)),
            "isUncertain": bool(prediction.get("isUncertain", False)),
            "uncertaintyReasons": prediction.get("uncertaintyReasons", []),
            "thresholdApplied": float(prediction.get("thresholdApplied", 0.0)),
            "margin": float(prediction.get("margin", 0.0)),
            "marginThreshold": float(prediction.get("marginThreshold", 0.0)),
            "topPredictions": prediction.get("topPredictions", []),
            "modelVersion": self.model.model_version,
            "latencyMs": latency_ms,
            "warnings": quality.warnings,
            "fileName": filename,
        }

    def predict_many(self, files: Iterable[tuple[str, bytes]], *, crop_hint: str = "auto") -> list[dict[str, Any]]:
        normalized_crop_hint = _normalize_crop_hint(crop_hint)
        return [
            self.predict_bytes(raw_bytes, filename=filename,
                               crop_hint=normalized_crop_hint)
            for filename, raw_bytes in files
        ]


def create_inference_service() -> DiseaseInferenceService:
    return DiseaseInferenceService()


def _env_flag(name: str, default: bool = False) -> bool:
    value = str(os.getenv(name, str(default))).strip().lower()
    return value in {"1", "true", "yes", "y", "on"}


def _normalize_disease_slug(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "unknown"
    text = re.sub(r"[^a-z0-9\s_-]", " ", text)
    text = re.sub(r"\s+", "_", text).strip("_")
    return text or "unknown"


def _infer_crop_from_diagnosis(diagnosis: str, crop_hint: str) -> str:
    hint = _normalize_crop_hint(crop_hint)
    if hint in {"beans", "maize"}:
        return "bean" if hint == "beans" else "maize"

    lowered = diagnosis.lower()
    if any(token in lowered for token in ["bean", "beans"]):
        return "bean"
    if any(token in lowered for token in ["maize", "corn"]):
        return "maize"
    if "cassava" in lowered:
        return "cassava"
    if "banana" in lowered:
        return "banana"
    if "potato" in lowered:
        return "potato"
    return "unknown"


def _parse_paligemma_response(text: str) -> tuple[str, str, str | None]:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if not normalized:
        return "unknown", "", None

    disease_match = re.search(
        r"disease\s*:\s*(.+?)(?=(?:\.\s*advice\s*:)|(?:\sadvice\s*:)|$)", normalized, flags=re.I)
    advice_match = re.search(
        r"advice\s*:\s*(.+?)(?=(?:\.\s*source\s*:)|(?:\ssource\s*:)|$)", normalized, flags=re.I)
    source_match = re.search(r"source\s*:\s*(.+)$", normalized, flags=re.I)

    diagnosis = disease_match.group(1).strip(
        " .") if disease_match else normalized.split(".")[0].strip(" .")
    recommendation = advice_match.group(
        1).strip() if advice_match else normalized
    source = source_match.group(1).strip() if source_match else None
    return diagnosis or "unknown", recommendation, source


class PaliGemmaGenerationModel:
    def __init__(self):
        self.adapter_dir = os.getenv(
            "PALIGEMMA_ADAPTER_DIR", os.path.join("model", "paligemma-rwanda-lora"))
        self.base_model = os.getenv(
            "PALIGEMMA_BASE_MODEL", "google/paligemma2-3b-pt-448")
        self.base_model_path = os.getenv("PALIGEMMA_BASE_MODEL_PATH")
        self.allow_remote = _env_flag("PALIGEMMA_ALLOW_REMOTE", False)
        self.max_new_tokens = int(os.getenv("PALIGEMMA_MAX_NEW_TOKENS", "180"))
        self.temperature = float(os.getenv("PALIGEMMA_TEMPERATURE", "0.0"))
        self.top_p = float(os.getenv("PALIGEMMA_TOP_P", "0.9"))
        self.model_version = os.getenv(
            "PALIGEMMA_MODEL_VERSION", "paligemma-rwanda-lora-v1")
        self.prompt_template = os.getenv(
            "PALIGEMMA_PROMPT_TEMPLATE",
            (
                "A farmer uploaded this {crop_part} leaf image from Rwanda. "
                "Identify the likely disease and provide practical recommendation. "
                "Format exactly as: Disease: <name>. Advice: <recommendation>."
            ),
        )

        self._torch = None
        self._model = None
        self._processor = None
        self._device = "cpu"
        self._dtype = None

    def load_model(self) -> None:
        from peft import PeftModel
        from transformers import AutoProcessor, PaliGemmaForConditionalGeneration
        import torch

        self._torch = torch
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        if self._device == "cuda":
            self._dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        else:
            # Use bfloat16 on CPU to halve memory usage (12 GB → 6 GB for 3B params).
            # bfloat16 is natively supported on x86-64 CPUs via PyTorch 2.0+.
            self._dtype = torch.bfloat16

        model_ref = self.base_model_path or self.base_model
        local_files_only = not self.allow_remote

        processor_ref = self.adapter_dir if os.path.exists(os.path.join(
            self.adapter_dir, "processor_config.json")) else model_ref
        # Keep the processor behavior aligned with training/inference notebooks.
        # Fast image processors can alter tensor layout/shape expectations.
        self._processor = AutoProcessor.from_pretrained(
            processor_ref,
            local_files_only=local_files_only,
            use_fast=False,
        )

        base_model = PaliGemmaForConditionalGeneration.from_pretrained(
            model_ref,
            local_files_only=local_files_only,
            torch_dtype=self._dtype,
            low_cpu_mem_usage=True,
        )
        self._model = PeftModel.from_pretrained(
            base_model, self.adapter_dir, is_trainable=False)
        self._model.to(self._device)
        self._model.eval()

    def preprocess(self, image: Image.Image) -> Image.Image:
        return image.convert("RGB")

    def _build_prompt(self, crop_hint: str) -> str:
        normalized_hint = _normalize_crop_hint(crop_hint)
        crop_part = "beans" if normalized_hint == "beans" else (
            "maize" if normalized_hint == "maize" else "crop")
        prompt = self.prompt_template.format(crop_part=crop_part)
        if not prompt.startswith("<image>"):
            prompt = f"<image> {prompt}"
        return prompt

    def generate(self, image: Image.Image, *, crop_hint: str = "auto") -> dict[str, Any]:
        if self._model is None or self._processor is None or self._torch is None:
            raise RuntimeError("PaliGemma model is not initialized")

        prompt = self._build_prompt(crop_hint=crop_hint)
        # Use the default processor image path to keep tensor shapes compatible
        # with PaLiGemma expectations.
        inputs = self._processor(images=image, text=prompt, return_tensors="pt")

        # Some processor/runtime combinations can emit NHWC pixel tensors.
        # PaLiGemma expects NCHW (batch, channels, height, width).
        pixel_values = inputs.get("pixel_values")
        if hasattr(pixel_values, "ndim") and pixel_values.ndim == 4:
            if int(pixel_values.shape[1]) != 3 and int(pixel_values.shape[-1]) == 3:
                pixel_values = pixel_values.permute(0, 3, 1, 2).contiguous()
                inputs["pixel_values"] = pixel_values

            if int(inputs["pixel_values"].shape[1]) != 3:
                raise RuntimeError(
                    f"Unexpected pixel_values shape for PaLiGemma: {tuple(inputs['pixel_values'].shape)}"
                )

        inputs = {k: v.to(self._device) if hasattr(v, "to")
                  else v for k, v in inputs.items()}

        with self._torch.no_grad():
            do_sample = self.temperature > 0
            gen_kwargs = {
                "max_new_tokens": self.max_new_tokens,
                "do_sample": do_sample,
            }
            if do_sample:
                gen_kwargs["temperature"] = self.temperature
                gen_kwargs["top_p"] = self.top_p
            output_ids = self._model.generate(**inputs, **gen_kwargs)

        prompt_len = int(inputs["input_ids"].shape[1])
        generated_ids = output_ids[0][prompt_len:]
        generated_text = self._processor.tokenizer.decode(
            generated_ids, skip_special_tokens=True).strip()

        diagnosis, recommendation, source = _parse_paligemma_response(
            generated_text)
        disease_slug = _normalize_disease_slug(diagnosis)
        crop_type = _infer_crop_from_diagnosis(diagnosis, crop_hint=crop_hint)
        is_uncertain = disease_slug in {"unknown", "uncertain"}

        return {
            "cropType": crop_type,
            "disease": disease_slug,
            "candidateDisease": disease_slug,
            "diagnosis": diagnosis,
            "recommendation": recommendation,
            "generatedText": generated_text,
            "source": source,
            "confidence": 0.0,
            "isUncertain": is_uncertain,
            "uncertaintyReasons": [] if not is_uncertain else ["Model could not extract a clear disease label."],
            "topPredictions": [],
        }


class PaliGemmaGenerationService:
    def __init__(self, model: PaliGemmaGenerationModel | None = None):
        self.model = model or PaliGemmaGenerationModel()
        self.quality_checker = ImageQualityChecker()
        self.model.load_model()

    def _open_image(self, raw_bytes: bytes) -> Image.Image:
        return Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    def generate_bytes(self, raw_bytes: bytes, *, filename: str, crop_hint: str = "auto") -> dict[str, Any]:
        started = time.perf_counter()
        image = self._open_image(raw_bytes)
        quality = self.quality_checker.assess(image)
        result = self.model.generate(image, crop_hint=crop_hint)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)

        return {
            "imageId": str(uuid.uuid4()),
            "cropType": result.get("cropType", "unknown"),
            "disease": result.get("disease", "unknown"),
            "candidateDisease": result.get("candidateDisease"),
            "diagnosis": result.get("diagnosis", "unknown"),
            "recommendation": result.get("recommendation", ""),
            "generatedText": result.get("generatedText", ""),
            "source": result.get("source"),
            "confidence": float(result.get("confidence", 0.0)),
            "isUncertain": bool(result.get("isUncertain", False)),
            "uncertaintyReasons": result.get("uncertaintyReasons", []),
            "topPredictions": result.get("topPredictions", []),
            "modelVersion": self.model.model_version,
            "latencyMs": latency_ms,
            "warnings": quality.warnings,
            "fileName": filename,
        }

    def generate_many(self, files: Iterable[tuple[str, bytes]], *, crop_hint: str = "auto") -> list[dict[str, Any]]:
        normalized_crop_hint = _normalize_crop_hint(crop_hint)
        return [
            self.generate_bytes(raw_bytes, filename=filename,
                                crop_hint=normalized_crop_hint)
            for filename, raw_bytes in files
        ]


def create_paligemma_generation_service() -> PaliGemmaGenerationService:
    return PaliGemmaGenerationService()
