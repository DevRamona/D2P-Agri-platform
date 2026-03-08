import argparse
import json
import os
from collections import defaultdict

import matplotlib.pyplot as plt
import seaborn as sns
import torch
from sklearn.metrics import classification_report, confusion_matrix

try:
    from dataset import get_dataloaders
    from finetune_dataset import get_manifest_dataloaders
    from model import get_model
except ImportError:  # pragma: no cover - supports `python -m model.evaluate`
    from .dataset import get_dataloaders
    from .finetune_dataset import get_manifest_dataloaders
    from .model import get_model


def _parse_class_names_arg(raw_value):
    if not raw_value:
        return None
    names = [item.strip() for item in str(raw_value).split(",") if item.strip()]
    return names or None


def _sidecar_metadata_candidates(model_path):
    base, _ = os.path.splitext(model_path)
    return [f"{base}.labels.json", f"{model_path}.labels.json"]


def _load_label_metadata(model_path):
    for candidate in _sidecar_metadata_candidates(model_path):
        if os.path.exists(candidate):
            with open(candidate, "r", encoding="utf-8") as handle:
                return json.load(handle), candidate
    return None, None


def _compute_group_accuracy(predictions, labels, sample_metadata, *, min_samples=5):
    if not sample_metadata:
        return {}

    keys = ["province", "district", "season", "rainfall_band"]
    groups = defaultdict(lambda: {"correct": 0, "total": 0})

    for idx, (pred_idx, true_idx) in enumerate(zip(predictions, labels)):
        metadata = sample_metadata[idx] if idx < len(sample_metadata) else {}
        if not isinstance(metadata, dict):
            continue

        for key in keys:
            value = str(metadata.get(key) or "").strip().lower()
            if not value:
                continue
            bucket = groups[(key, value)]
            bucket["total"] += 1
            if pred_idx == true_idx:
                bucket["correct"] += 1

    rows = []
    for (key, value), item in groups.items():
        if item["total"] < min_samples:
            continue
        rows.append(
            (
                f"{key}:{value}",
                {
                    "samples": int(item["total"]),
                    "accuracy": round(item["correct"] / item["total"], 4),
                },
            )
        )
    rows.sort(key=lambda row: row[1]["samples"], reverse=True)
    return dict(rows[:40])


def evaluate_model(
    model_path,
    data_dir=None,
    *,
    batch_size=32,
    class_names=None,
    num_workers=0,
    manifest_path=None,
    manifest_images_root=None,
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    if manifest_path:
        _, _, test_loader = get_manifest_dataloaders(
            manifest_path=manifest_path,
            batch_size=batch_size,
            num_workers=num_workers,
            class_names=class_names,
            images_root=manifest_images_root,
        )
    else:
        _, _, test_loader = get_dataloaders(
            data_dir=data_dir,
            batch_size=batch_size,
            num_workers=num_workers,
            class_names=class_names,
        )

    detected_class_names = list(getattr(test_loader.dataset, "class_names", []))
    if not detected_class_names:
        raise RuntimeError("Could not read class names from the test dataset.")
    print(f"Detected test classes: {detected_class_names}")

    metadata, metadata_path = _load_label_metadata(model_path)
    if metadata:
        print(f"Loaded model label metadata: {metadata_path}")
        metadata_classes = list(metadata.get("class_names") or [])
        if metadata_classes and metadata_classes != detected_class_names:
            print(
                "Warning: dataset classes do not match the saved model metadata.\n"
                f"  Dataset: {detected_class_names}\n"
                f"  Metadata: {metadata_classes}"
            )
        calibration = metadata.get("calibration")
        if calibration:
            print("Calibration info found in sidecar metadata:")
            print(
                json.dumps(
                    {
                        "default_confidence_threshold": calibration.get("default_confidence_threshold"),
                        "margin_threshold": calibration.get("margin_threshold"),
                    },
                    indent=2,
                )
            )

    model = get_model(num_classes=len(detected_class_names))
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()

    all_preds = []
    all_labels = []

    print("Evaluating on test set...")
    with torch.no_grad():
        for inputs, labels in test_loader:
            inputs = inputs.to(device)
            labels = labels.to(device)

            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)

            all_preds.extend(preds.cpu().numpy().tolist())
            all_labels.extend(labels.cpu().numpy().tolist())

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds, target_names=detected_class_names))

    sample_metadata = list(getattr(test_loader.dataset, "sample_metadata", []))
    group_accuracy = _compute_group_accuracy(all_preds, all_labels, sample_metadata)
    if group_accuracy:
        print("\nDomain Accuracy (metadata-aware):")
        print(json.dumps(group_accuracy, indent=2))

    print("\nConfusion Matrix:")
    cm = confusion_matrix(all_labels, all_preds)
    print(cm)

    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", xticklabels=detected_class_names, yticklabels=detected_class_names)
    plt.ylabel("Actual")
    plt.xlabel("Predicted")
    plt.title("Confusion Matrix")
    plt.savefig("confusion_matrix.png")
    print("Confusion matrix saved to confusion_matrix.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Leaf Disease Classification Model (bean or maize)")
    parser.add_argument("--model_path", type=str, required=True, help="Path to trained model .pth file")
    parser.add_argument("--data_dir", type=str, default=None, help="Path to dataset root")
    parser.add_argument("--manifest_path", type=str, default=None, help="CSV manifest path for metadata-aware datasets")
    parser.add_argument(
        "--manifest_images_root",
        type=str,
        default=None,
        help="Optional root folder where manifest image paths are resolved first",
    )
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument(
        "--class_names",
        type=str,
        default=None,
        help="Optional comma-separated class names/folder names to enforce label order",
    )
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader workers")

    args = parser.parse_args()
    if args.manifest_path and args.data_dir:
        parser.error("Use --manifest_path or --data_dir, not both.")
    if not args.manifest_path and not args.data_dir:
        parser.error("Provide --manifest_path or --data_dir")

    evaluate_model(
        args.model_path,
        args.data_dir,
        batch_size=args.batch_size,
        class_names=_parse_class_names_arg(args.class_names),
        num_workers=args.num_workers,
        manifest_path=args.manifest_path,
        manifest_images_root=args.manifest_images_root,
    )
