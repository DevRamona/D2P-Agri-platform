import argparse
import json
import os

import matplotlib.pyplot as plt
import seaborn as sns
import torch
from sklearn.metrics import classification_report, confusion_matrix

try:
    from dataset import get_dataloaders
    from model import get_model
except ImportError:  # pragma: no cover - supports `python -m model.evaluate`
    from .dataset import get_dataloaders
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


def evaluate_model(model_path, data_dir, batch_size=32, class_names=None, num_workers=0):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    _, _, test_loader = get_dataloaders(
        data_dir,
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

            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds, target_names=detected_class_names))

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
    parser.add_argument("--data_dir", type=str, required=True, help="Path to dataset")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument(
        "--class_names",
        type=str,
        default=None,
        help="Optional comma-separated class names/folder names to enforce label order",
    )
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader workers")

    args = parser.parse_args()

    evaluate_model(
        args.model_path,
        args.data_dir,
        batch_size=args.batch_size,
        class_names=_parse_class_names_arg(args.class_names),
        num_workers=args.num_workers,
    )
