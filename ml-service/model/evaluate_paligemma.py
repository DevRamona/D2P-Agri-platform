import argparse
import csv
import json
import os
import re
from pathlib import Path

import matplotlib.pyplot as plt
from PIL import Image
from dotenv import load_dotenv
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, precision_score, recall_score

try:
    import seaborn as sns
except ImportError:  # pragma: no cover - optional plotting dependency
    sns = None

try:
    from dataset import LeafDiseaseDataset, MultiCropLeafDiseaseDataset, normalize_class_name
    from finetune_dataset import ManifestLeafDiseaseDataset, normalize_crop_name
except ImportError:  # pragma: no cover - supports `python -m model.evaluate_paligemma`
    from .dataset import LeafDiseaseDataset, MultiCropLeafDiseaseDataset, normalize_class_name
    from .finetune_dataset import ManifestLeafDiseaseDataset, normalize_crop_name


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

UNMATCHED_LABEL = "__unmatched__"


def _parse_class_names_arg(raw_value):
    if not raw_value:
        return None
    names = [item.strip() for item in str(raw_value).split(",") if item.strip()]
    return names or None


def _parse_paths_arg(raw_value):
    if not raw_value:
        return None
    paths = [item.strip() for item in str(raw_value).split(",") if item.strip()]
    return paths or None


def _normalize_free_text(value):
    text = str(value or "").strip().lower()
    text = text.replace("&", "and")
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text


def _normalize_jsonl_label(value):
    return normalize_class_name(str(value or "").strip())


def _crop_from_label(label):
    raw = str(label or "").strip().lower()
    if ":" in raw:
        crop_name = raw.split(":", 1)[0]
        return normalize_crop_name(crop_name)
    if "maize" in raw or "corn" in raw:
        return "maize"
    if "bean" in raw:
        return "bean"
    return None


def _render_label_for_prompt(label):
    raw = str(label or "").strip()
    if ":" in raw:
        crop_name, disease_name = raw.split(":", 1)
        crop_name = normalize_crop_name(crop_name)
        disease_text = disease_name.replace("_", " ").strip()
        if disease_text.startswith(f"{crop_name} "):
            disease_text = disease_text[len(crop_name) + 1 :].strip()
        if disease_text == "healthy":
            return f"{crop_name} healthy"
        return f"{crop_name} {disease_text}"
    return raw.replace("_", " ")


def _build_label_aliases(label):
    raw = str(label or "").strip()
    aliases = {raw, raw.replace(":", " "), _render_label_for_prompt(raw)}

    if ":" in raw:
        crop_name, disease_name = raw.split(":", 1)
        crop_name = normalize_crop_name(crop_name)
        aliases.add(f"{crop_name}_{disease_name}")
        aliases.add(disease_name)
        if disease_name == "healthy":
            aliases.add("healthy")

    return {alias for alias in (_normalize_free_text(item) for item in aliases) if alias}


def _match_generated_label(text, class_names, *, crop_hint=None):
    normalized_text = _normalize_free_text(text)
    if not normalized_text:
        return None

    best_label = None
    best_score = -1

    for label in class_names:
        crop_name = _crop_from_label(label)
        aliases = _build_label_aliases(label)
        label_score = -1

        for alias in aliases:
            if normalized_text == alias:
                label_score = max(label_score, 1000 + len(alias))
            elif alias and re.search(rf"(^|_){re.escape(alias)}($|_)", normalized_text):
                label_score = max(label_score, 500 + len(alias))

        if label_score >= 0 and crop_hint and crop_name and crop_name == crop_hint:
            label_score += 25

        if label_score > best_score:
            best_score = label_score
            best_label = label

    return best_label if best_score >= 0 else None


def _crop_hint_for_sample(label, metadata):
    crop_hint = _crop_from_label(label)
    if crop_hint in {"bean", "maize"}:
        return crop_hint

    if isinstance(metadata, dict):
        metadata_crop = normalize_crop_name(metadata.get("crop_type") or metadata.get("crop"))
        if metadata_crop in {"bean", "maize"}:
            return metadata_crop
    return None


def _resolve_jsonl_image_path(image_ref, *, jsonl_dir, images_root):
    raw_path = str(image_ref or "").strip()
    if not raw_path:
        return None
    if os.path.isabs(raw_path):
        return raw_path

    candidates = []
    if images_root:
        candidates.append(os.path.join(images_root, raw_path))
    candidates.append(os.path.join(jsonl_dir, raw_path))

    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return candidates[0] if candidates else None


def _extract_labels_from_suffix(suffix):
    raw_suffix = str(suffix or "").strip()
    if not raw_suffix:
        return []

    labels = []
    matches = re.findall(
        r"(?:<loc\d{4}>){4}\s*([^<]+?)(?=(?:\s*<loc\d{4}>){4}|$)",
        raw_suffix,
        flags=re.IGNORECASE,
    )
    for match in matches:
        normalized = _normalize_jsonl_label(match)
        if normalized:
            labels.append(normalized)

    if labels:
        return list(dict.fromkeys(labels))

    normalized = _normalize_jsonl_label(raw_suffix)
    return [normalized] if normalized else []


class PaliGemmaJsonlDataset:
    def __init__(self, jsonl_path, *, images_root=None, class_names=None):
        self.jsonl_path = jsonl_path
        self.samples = []
        self.sample_metadata = []
        self.source_dirs = [f"jsonl:{os.path.basename(jsonl_path)}"]
        self.skipped_empty_suffix = 0
        self.skipped_multilabel = 0

        if not os.path.exists(jsonl_path):
            raise FileNotFoundError(f"JSONL annotations not found: {jsonl_path}")

        jsonl_dir = os.path.dirname(os.path.abspath(jsonl_path))
        resolved_images_root = os.path.abspath(images_root) if images_root else None
        discovered_labels = []

        with open(jsonl_path, "r", encoding="utf-8") as handle:
            for row_number, line in enumerate(handle, start=1):
                stripped = line.strip()
                if not stripped:
                    continue

                record = json.loads(stripped)
                image_path = _resolve_jsonl_image_path(
                    record.get("image"),
                    jsonl_dir=jsonl_dir,
                    images_root=resolved_images_root,
                )
                if not image_path:
                    raise RuntimeError(f"Row {row_number}: missing image path in JSONL record")
                if not os.path.exists(image_path):
                    raise RuntimeError(f"Row {row_number}: image not found: {image_path}")

                suffix_labels = _extract_labels_from_suffix(record.get("suffix"))
                if not suffix_labels:
                    self.skipped_empty_suffix += 1
                    continue
                if len(suffix_labels) > 1:
                    self.skipped_multilabel += 1
                    continue

                discovered_labels.append(suffix_labels[0])
                self.sample_metadata.append(
                    {
                        "prefix": str(record.get("prefix") or "").strip(),
                        "suffix": str(record.get("suffix") or "").strip(),
                        "source_format": "paligemma_jsonl",
                    }
                )
                self.samples.append((image_path, suffix_labels[0]))

        if not self.samples:
            raise RuntimeError(
                f"No usable evaluation samples found in {jsonl_path}. "
                "Records with empty or multi-label suffixes were skipped."
            )

        if class_names:
            normalized_requested = [_normalize_jsonl_label(name) for name in class_names]
            missing = [name for name in normalized_requested if name not in discovered_labels]
            if missing:
                raise RuntimeError(f"Requested classes not found in JSONL dataset: {missing}")
            self.class_names = list(dict.fromkeys(normalized_requested))
        else:
            self.class_names = list(dict.fromkeys(discovered_labels))

        self.class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}
        self.idx_to_class = {idx: name for name, idx in self.class_to_idx.items()}
        self.crop_type = "mixed"
        self.samples = [
            (image_path, self.class_to_idx[label])
            for image_path, label in self.samples
            if label in self.class_to_idx
        ]


def _load_dataset(
    *,
    data_dir,
    data_dirs,
    manifest_path,
    manifest_images_root,
    jsonl_path,
    jsonl_images_root,
    class_names,
):
    if jsonl_path:
        return PaliGemmaJsonlDataset(
            jsonl_path=jsonl_path,
            images_root=jsonl_images_root,
            class_names=class_names,
        )
    if manifest_path:
        return ManifestLeafDiseaseDataset(
            manifest_path=manifest_path,
            transform=None,
            class_names=class_names,
            images_root=manifest_images_root,
        )
    if data_dirs:
        return MultiCropLeafDiseaseDataset(root_dirs=data_dirs, transform=None)
    return LeafDiseaseDataset(root_dir=data_dir, transform=None, class_names=class_names)


def _save_confusion_matrix(cm, labels, output_path):
    plt.figure(figsize=(10, 8))
    if sns is not None:
        sns.heatmap(cm, annot=True, fmt="d", xticklabels=labels, yticklabels=labels)
    else:
        plt.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
        plt.colorbar()
        tick_positions = list(range(len(labels)))
        plt.xticks(tick_positions, labels, rotation=45, ha="right")
        plt.yticks(tick_positions, labels)
        threshold = cm.max() / 2.0 if cm.size else 0.0
        for row in range(cm.shape[0]):
            for col in range(cm.shape[1]):
                plt.text(
                    col,
                    row,
                    format(cm[row, col], "d"),
                    ha="center",
                    va="center",
                    color="white" if cm[row, col] > threshold else "black",
                )
    plt.ylabel("Actual")
    plt.xlabel("Predicted")
    plt.title("PaLiGemma Confusion Matrix")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


class PaliGemmaEvaluator:
    def __init__(self):
        self.adapter_dir = os.getenv("PALIGEMMA_ADAPTER_DIR", os.path.join("model", "paligemma-rwanda-lora"))
        self.base_model = os.getenv("PALIGEMMA_BASE_MODEL", "google/paligemma2-3b-pt-448")
        self.base_model_path = os.getenv("PALIGEMMA_BASE_MODEL_PATH") or None
        self.allow_remote = str(os.getenv("PALIGEMMA_ALLOW_REMOTE", "false")).strip().lower() in {"1", "true", "yes", "on"}
        self.max_new_tokens = int(os.getenv("PALIGEMMA_MAX_NEW_TOKENS", "24"))
        self.temperature = float(os.getenv("PALIGEMMA_TEMPERATURE", "0.0"))
        self.top_p = float(os.getenv("PALIGEMMA_TOP_P", "0.9"))
        self.model_version = os.getenv("PALIGEMMA_MODEL_VERSION", "paligemma-rwanda-lora-v1")

        self._processor = None
        self._model = None
        self._device = "cpu"
        self._torch = None

    def load(self):
        from peft import PeftModel
        from transformers import AutoProcessor, PaliGemmaForConditionalGeneration
        import torch

        self._torch = torch
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if self._device == "cuda" and torch.cuda.is_bf16_supported() else (
            torch.float16 if self._device == "cuda" else torch.float32
        )

        model_ref = self.base_model_path or self.base_model
        local_files_only = not self.allow_remote
        processor_ref = self.adapter_dir if os.path.exists(os.path.join(self.adapter_dir, "processor_config.json")) else model_ref

        self._processor = AutoProcessor.from_pretrained(processor_ref, local_files_only=local_files_only, use_fast=False)
        base_model = PaliGemmaForConditionalGeneration.from_pretrained(
            model_ref,
            local_files_only=local_files_only,
            torch_dtype=dtype,
            low_cpu_mem_usage=True,
        )
        self._model = PeftModel.from_pretrained(base_model, self.adapter_dir, is_trainable=False)
        self._model.to(self._device)
        self._model.eval()

    def _build_prompt(self, class_names, *, crop_hint=None):
        rendered_labels = [_render_label_for_prompt(label) for label in class_names]
        crop_phrase = f" for {crop_hint}" if crop_hint in {"bean", "maize"} else ""
        return (
            f"<image> Identify the disease label{crop_phrase} in this Rwanda crop image. "
            f"Choose exactly one label from: {' ; '.join(rendered_labels)}. "
            "Respond with only the label."
        )

    def predict_label(self, image, *, class_names, crop_hint=None):
        if self._model is None or self._processor is None or self._torch is None:
            raise RuntimeError("PaliGemma evaluator model is not loaded")

        prompt = self._build_prompt(class_names, crop_hint=crop_hint)
        inputs = self._processor(images=image.convert("RGB"), text=prompt, return_tensors="pt")
        inputs = {key: value.to(self._device) if hasattr(value, "to") else value for key, value in inputs.items()}

        with self._torch.no_grad():
            output_ids = self._model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                do_sample=self.temperature > 0,
                temperature=max(self.temperature, 1e-5),
                top_p=self.top_p,
            )

        prompt_len = int(inputs["input_ids"].shape[1])
        generated_ids = output_ids[0][prompt_len:]
        raw_text = self._processor.tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
        predicted_label = _match_generated_label(raw_text, class_names, crop_hint=crop_hint)
        return predicted_label, raw_text


def evaluate_paligemma(
    *,
    data_dir,
    data_dirs,
    manifest_path,
    manifest_images_root,
    jsonl_path,
    jsonl_images_root,
    class_names,
    output_dir,
    prompt_scope,
):
    dataset = _load_dataset(
        data_dir=data_dir,
        data_dirs=data_dirs,
        manifest_path=manifest_path,
        manifest_images_root=manifest_images_root,
        jsonl_path=jsonl_path,
        jsonl_images_root=jsonl_images_root,
        class_names=class_names,
    )
    all_class_names = list(dataset.class_names)
    evaluator = PaliGemmaEvaluator()
    evaluator.load()

    print(f"Loaded {len(dataset.samples)} evaluation samples")
    print(f"Class labels: {all_class_names}")
    print(f"Model version: {evaluator.model_version}")
    skipped_empty = int(getattr(dataset, "skipped_empty_suffix", 0))
    skipped_multilabel = int(getattr(dataset, "skipped_multilabel", 0))
    if skipped_empty or skipped_multilabel:
        print(
            f"Skipped JSONL records with no usable single label: "
            f"empty_suffix={skipped_empty}, multi_label={skipped_multilabel}"
        )

    predictions_rows = []
    y_true = []
    y_pred = []

    class_to_idx = {label: idx for idx, label in enumerate(all_class_names)}
    unmatched_index = len(all_class_names)
    metrics_labels = list(all_class_names)

    for index, (image_path, label_idx) in enumerate(dataset.samples, start=1):
        true_label = all_class_names[int(label_idx)]
        metadata = dataset.sample_metadata[index - 1] if hasattr(dataset, "sample_metadata") and index - 1 < len(dataset.sample_metadata) else {}
        crop_hint = _crop_hint_for_sample(true_label, metadata)

        candidate_labels = list(all_class_names)
        if prompt_scope == "per_crop" and crop_hint in {"bean", "maize"}:
            filtered = [
                label for label in all_class_names if _crop_from_label(label) in {None, crop_hint}
            ]
            if filtered:
                candidate_labels = filtered

        image = Image.open(image_path).convert("RGB")
        predicted_label, raw_text = evaluator.predict_label(
            image,
            class_names=candidate_labels,
            crop_hint=crop_hint,
        )

        y_true.append(class_to_idx[true_label])
        y_pred.append(class_to_idx[predicted_label] if predicted_label in class_to_idx else unmatched_index)

        predictions_rows.append(
            {
                "image_path": image_path,
                "true_label": true_label,
                "predicted_label": predicted_label or UNMATCHED_LABEL,
                "raw_response": raw_text,
                "correct": str(predicted_label == true_label).lower(),
                "crop_hint": crop_hint or "",
                "province": metadata.get("province", "") if isinstance(metadata, dict) else "",
                "district": metadata.get("district", "") if isinstance(metadata, dict) else "",
            }
        )

        if index % 10 == 0 or index == len(dataset.samples):
            print(f"Processed {index}/{len(dataset.samples)} samples")

    target_names = list(metrics_labels)
    labels_for_metrics = list(range(len(metrics_labels)))
    if any(pred == unmatched_index for pred in y_pred):
        target_names.append(UNMATCHED_LABEL)
        labels_for_metrics.append(unmatched_index)

    accuracy = accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(y_true, y_pred, average="macro", labels=labels_for_metrics, zero_division=0)
    weighted_f1 = f1_score(y_true, y_pred, average="weighted", labels=labels_for_metrics, zero_division=0)
    micro_f1 = f1_score(y_true, y_pred, average="micro", labels=labels_for_metrics, zero_division=0)
    macro_precision = precision_score(y_true, y_pred, average="macro", labels=labels_for_metrics, zero_division=0)
    weighted_precision = precision_score(y_true, y_pred, average="weighted", labels=labels_for_metrics, zero_division=0)
    macro_recall = recall_score(y_true, y_pred, average="macro", labels=labels_for_metrics, zero_division=0)
    weighted_recall = recall_score(y_true, y_pred, average="weighted", labels=labels_for_metrics, zero_division=0)

    os.makedirs(output_dir, exist_ok=True)
    predictions_csv_path = os.path.join(output_dir, "paligemma_predictions.csv")
    with open(predictions_csv_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["image_path", "true_label", "predicted_label", "raw_response", "correct", "crop_hint", "province", "district"],
        )
        writer.writeheader()
        writer.writerows(predictions_rows)

    report = classification_report(
        y_true,
        y_pred,
        labels=labels_for_metrics,
        target_names=target_names,
        output_dict=True,
        zero_division=0,
    )

    cm = confusion_matrix(y_true, y_pred, labels=labels_for_metrics)
    confusion_path = os.path.join(output_dir, "paligemma_confusion_matrix.png")
    _save_confusion_matrix(cm, target_names, confusion_path)

    metrics = {
        "model_version": evaluator.model_version,
        "sample_count": len(dataset.samples),
        "skipped_empty_suffix": skipped_empty,
        "skipped_multilabel": skipped_multilabel,
        "unmatched_predictions": sum(1 for pred in y_pred if pred == unmatched_index),
        "prompt_scope": prompt_scope,
        "accuracy": round(float(accuracy), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "micro_f1": round(float(micro_f1), 4),
        "macro_precision": round(float(macro_precision), 4),
        "weighted_precision": round(float(weighted_precision), 4),
        "macro_recall": round(float(macro_recall), 4),
        "weighted_recall": round(float(weighted_recall), 4),
        "class_names": target_names,
        "classification_report": report,
        "confusion_matrix_path": os.path.abspath(confusion_path),
        "predictions_csv_path": os.path.abspath(predictions_csv_path),
    }

    metrics_json_path = os.path.join(output_dir, "paligemma_evaluation_metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    print("\nEvaluation Summary:")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Macro F1 Score: {macro_f1:.4f}")
    print(f"Weighted F1 Score: {weighted_f1:.4f}")
    print(f"Micro F1 Score: {micro_f1:.4f}")
    print(f"Macro Precision: {macro_precision:.4f}")
    print(f"Weighted Precision: {weighted_precision:.4f}")
    print(f"Macro Recall: {macro_recall:.4f}")
    print(f"Weighted Recall: {weighted_recall:.4f}")
    print(f"Unmatched predictions: {sum(1 for pred in y_pred if pred == unmatched_index)}")
    print(f"Saved metrics to {metrics_json_path}")
    print(f"Saved predictions to {predictions_csv_path}")
    print(f"Saved confusion matrix to {confusion_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate fine-tuned PaLiGemma disease model with F1 metrics")
    parser.add_argument("--data_dir", type=str, default=None, help="Held-out dataset root with class folders")
    parser.add_argument(
        "--data_dirs",
        type=str,
        default=None,
        help="Comma-separated dataset roots for combined evaluation",
    )
    parser.add_argument("--manifest_path", type=str, default=None, help="CSV manifest path for evaluation data")
    parser.add_argument(
        "--manifest_images_root",
        type=str,
        default=None,
        help="Optional root folder used to resolve manifest image paths",
    )
    parser.add_argument(
        "--jsonl_path",
        type=str,
        default=None,
        help="Path to Roboflow/PaliGemma JSONL annotations such as _annotations.test.jsonl",
    )
    parser.add_argument(
        "--jsonl_images_root",
        type=str,
        default=None,
        help="Root folder used to resolve JSONL image paths, e.g. the dataset folder that contains train/valid/test",
    )
    parser.add_argument(
        "--class_names",
        type=str,
        default=None,
        help="Optional comma-separated class names to enforce label order",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=".",
        help="Directory where evaluation outputs are saved",
    )
    parser.add_argument(
        "--prompt_scope",
        type=str,
        default="per_crop",
        choices=["all", "per_crop"],
        help="Use all labels in every prompt, or restrict prompts to the sample crop when available",
    )

    args = parser.parse_args()
    parsed_data_dirs = _parse_paths_arg(args.data_dirs)
    parsed_class_names = _parse_class_names_arg(args.class_names)

    selected_sources = [
        bool(args.manifest_path),
        bool(args.jsonl_path),
        bool(args.data_dir),
        bool(parsed_data_dirs),
    ]
    if sum(selected_sources) != 1:
        parser.error("Provide exactly one of --jsonl_path, --manifest_path, --data_dir, or --data_dirs.")

    evaluate_paligemma(
        data_dir=args.data_dir,
        data_dirs=parsed_data_dirs,
        manifest_path=args.manifest_path,
        manifest_images_root=args.manifest_images_root,
        jsonl_path=args.jsonl_path,
        jsonl_images_root=args.jsonl_images_root,
        class_names=parsed_class_names,
        output_dir=args.output_dir,
        prompt_scope=args.prompt_scope,
    )
