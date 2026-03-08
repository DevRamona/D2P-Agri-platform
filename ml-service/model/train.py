import argparse
import copy
import json
import os
import time
from collections import Counter, defaultdict

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler

try:
    from dataset import get_dataloaders
    from finetune_dataset import (
        compute_metadata_sample_weights,
        get_manifest_dataloaders,
        load_sampling_profile,
    )
    from model import get_model
except ImportError:  # pragma: no cover - supports `python -m model.train`
    from .dataset import get_dataloaders
    from .finetune_dataset import (
        compute_metadata_sample_weights,
        get_manifest_dataloaders,
        load_sampling_profile,
    )
    from .model import get_model


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


def _prefixed_labels(class_names, crop_type):
    if class_names and all(":" in str(name) for name in class_names):
        return list(class_names)
    normalized_crop = (crop_type or "").strip().lower()
    if normalized_crop in {"bean", "maize"}:
        return [f"{normalized_crop}:{name}" for name in class_names]
    return list(class_names)


def _clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def _quantile(values, q):
    if not values:
        return 0.0
    sorted_values = sorted(float(v) for v in values)
    if len(sorted_values) == 1:
        return sorted_values[0]
    position = _clamp(q, 0.0, 1.0) * (len(sorted_values) - 1)
    low = int(position)
    high = min(low + 1, len(sorted_values) - 1)
    if low == high:
        return sorted_values[low]
    ratio = position - low
    return sorted_values[low] * (1 - ratio) + sorted_values[high] * ratio


def _crop_from_label(label):
    if ":" in str(label):
        crop_name = str(label).split(":", 1)[0].strip().lower()
        if crop_name in {"bean", "beans"}:
            return "bean"
        if crop_name == "maize":
            return "maize"
    return "unknown"


def _collect_validation_records(model, dataloader, device):
    model.eval()
    records = []
    with torch.no_grad():
        for inputs, labels in dataloader:
            inputs = inputs.to(device)
            labels = labels.to(device)

            outputs = model(inputs)
            probabilities = torch.softmax(outputs, dim=1)
            top_k = min(2, probabilities.shape[1])
            top_values, top_indices = torch.topk(probabilities, k=top_k, dim=1)

            for row_index in range(labels.shape[0]):
                confidence = float(top_values[row_index, 0].item())
                pred_idx = int(top_indices[row_index, 0].item())
                true_idx = int(labels[row_index].item())

                second_conf = float(top_values[row_index, 1].item()) if top_k > 1 else 0.0
                margin = confidence - second_conf
                records.append(
                    {
                        "pred_idx": pred_idx,
                        "true_idx": true_idx,
                        "confidence": confidence,
                        "margin": margin,
                        "correct": pred_idx == true_idx,
                    }
                )
    return records


def _compute_group_accuracy(records, sample_metadata, *, min_samples=5):
    if not records or not sample_metadata:
        return {}

    keys = ["province", "district", "season", "rainfall_band"]
    stats = defaultdict(lambda: {"correct": 0, "total": 0})

    for index, record in enumerate(records):
        metadata = sample_metadata[index] if index < len(sample_metadata) else {}
        if not isinstance(metadata, dict):
            continue

        for key in keys:
            value = str(metadata.get(key) or "").strip().lower()
            if not value:
                continue
            entry = stats[(key, value)]
            entry["total"] += 1
            if record["correct"]:
                entry["correct"] += 1

    rows = []
    for (key, value), item in stats.items():
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


def _compute_calibration(
    records,
    class_names,
    sample_metadata,
    *,
    default_threshold=0.65,
    min_threshold=0.5,
    max_threshold=0.92,
    margin_floor=0.08,
):
    confidence_by_label = defaultdict(list)
    confidence_by_crop = defaultdict(list)
    correct_margins = []

    for record in records:
        true_label = class_names[record["true_idx"]]
        if record["correct"]:
            confidence_by_label[true_label].append(record["confidence"])
            crop_name = _crop_from_label(true_label)
            if crop_name in {"bean", "maize"}:
                confidence_by_crop[crop_name].append(record["confidence"])
            correct_margins.append(record["margin"])

    threshold_by_label = {}
    for label in class_names:
        values = confidence_by_label.get(label, [])
        if len(values) >= 3:
            threshold = _quantile(values, 0.2)
        else:
            threshold = default_threshold
        threshold_by_label[label] = round(_clamp(threshold, min_threshold, max_threshold), 4)

    threshold_by_crop = {}
    for crop_name in ["bean", "maize"]:
        values = confidence_by_crop.get(crop_name, [])
        if len(values) >= 5:
            threshold = _quantile(values, 0.2)
        else:
            threshold = default_threshold
        threshold_by_crop[crop_name] = round(_clamp(threshold, min_threshold, max_threshold), 4)

    if len(correct_margins) >= 5:
        margin_threshold = _quantile(correct_margins, 0.1)
    else:
        margin_threshold = margin_floor
    margin_threshold = round(_clamp(margin_threshold, margin_floor, 0.6), 4)

    return {
        "default_confidence_threshold": round(default_threshold, 4),
        "confidence_threshold_by_label": threshold_by_label,
        "confidence_threshold_by_crop": threshold_by_crop,
        "margin_threshold": margin_threshold,
        "group_accuracy": _compute_group_accuracy(records, sample_metadata),
        "generated_at_epoch_time": int(time.time()),
    }


def _write_labels_metadata(
    output_dir,
    model_file_name,
    *,
    class_names,
    crop_type,
    source_dirs,
    data_dir,
    best_val_acc,
    model_version,
    manifest_path=None,
    manifest_images_root=None,
    calibration=None,
    sampling_profile=None,
    split_seed=42,
):
    model_stem, _ = os.path.splitext(model_file_name)
    metadata_path = os.path.join(output_dir, f"{model_stem}.labels.json")
    payload = {
        "class_names": list(class_names),
        "crop_type": crop_type,
        "labels": _prefixed_labels(class_names, crop_type),
        "source_dirs": list(source_dirs or []),
        "best_val_accuracy": float(best_val_acc),
        "saved_at_epoch_time": int(time.time()),
        "model_version": str(model_version),
        "split_seed": int(split_seed),
    }

    if manifest_path:
        payload["manifest_path"] = os.path.abspath(manifest_path)
    if manifest_images_root:
        payload["manifest_images_root"] = os.path.abspath(manifest_images_root)

    if isinstance(data_dir, (list, tuple)):
        payload["data_dirs"] = [os.path.abspath(path) for path in data_dir]
    elif data_dir:
        payload["data_dir"] = os.path.abspath(data_dir)

    if calibration:
        payload["calibration"] = calibration
    if sampling_profile:
        payload["sampling_profile"] = sampling_profile

    with open(metadata_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return metadata_path


def _choose_dataloaders(
    *,
    data_dir,
    batch_size,
    num_workers,
    class_names,
    data_dirs,
    manifest_path,
    manifest_images_root,
    split_seed,
):
    if manifest_path:
        return get_manifest_dataloaders(
            manifest_path=manifest_path,
            batch_size=batch_size,
            num_workers=num_workers,
            class_names=class_names,
            images_root=manifest_images_root,
            split_seed=split_seed,
        )
    return get_dataloaders(
        data_dir=data_dir,
        batch_size=batch_size,
        num_workers=num_workers,
        class_names=class_names,
        data_dirs=data_dirs,
    )


def _build_weighted_sampler(train_loader, class_names, sampling_profile):
    train_dataset = train_loader.dataset
    sample_metadata = list(getattr(train_dataset, "sample_metadata", []))
    if not sample_metadata:
        return None

    full_dataset = train_loader.dataset.subset.dataset
    indices = train_loader.dataset.subset.indices
    label_indices = [full_dataset.samples[i][1] for i in indices]
    label_names = [class_names[label_idx] for label_idx in label_indices]

    sample_weights = compute_metadata_sample_weights(sample_metadata, label_names, sampling_profile)
    if not sample_weights:
        return None

    if not any(abs(float(weight) - 1.0) > 1e-6 for weight in sample_weights):
        return None

    tensor_weights = torch.DoubleTensor(sample_weights)
    return WeightedRandomSampler(tensor_weights, num_samples=len(sample_weights), replacement=True)


def train_model(
    data_dir,
    num_epochs=10,
    batch_size=32,
    learning_rate=0.001,
    output_dir=".",
    class_names=None,
    num_workers=0,
    data_dirs=None,
    manifest_path=None,
    manifest_images_root=None,
    sampling_profile_path=None,
    split_seed=42,
    calibration_default_threshold=0.65,
    calibration_min_threshold=0.5,
    calibration_max_threshold=0.92,
    calibration_margin_floor=0.08,
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    train_loader, val_loader, _ = _choose_dataloaders(
        data_dir=data_dir,
        batch_size=batch_size,
        num_workers=num_workers,
        class_names=class_names,
        data_dirs=data_dirs,
        manifest_path=manifest_path,
        manifest_images_root=manifest_images_root,
        split_seed=split_seed,
    )

    train_dataset = train_loader.dataset
    detected_class_names = list(getattr(train_dataset, "class_names", []))
    if not detected_class_names:
        raise RuntimeError("Could not read class names from the training dataset.")

    crop_type = getattr(train_dataset, "crop_type", "unknown")
    source_dirs = getattr(train_dataset, "source_dirs", [])
    num_classes = len(detected_class_names)

    print(f"Detected crop type: {crop_type}")
    print(f"Detected classes ({num_classes}): {detected_class_names}")
    if source_dirs:
        print(f"Source directories: {source_dirs}")

    full_dataset = train_loader.dataset.subset.dataset
    indices = train_loader.dataset.subset.indices
    all_labels = [full_dataset.samples[i][1] for i in indices]
    class_counts = Counter(all_labels)
    total_samples = len(all_labels)

    readable_distribution = {
        detected_class_names[idx]: int(class_counts.get(idx, 0)) for idx in range(num_classes)
    }
    print(f"Training distribution: {readable_distribution}")

    weights = []
    for idx in range(num_classes):
        count = class_counts.get(idx, 0)
        if count > 0:
            weight = total_samples / (num_classes * count)
        else:
            weight = 1.0
        weights.append(weight)

    class_weights = torch.FloatTensor(weights).to(device)
    print(f"Class weights: {weights}")

    sampling_profile = load_sampling_profile(sampling_profile_path)
    sampler = _build_weighted_sampler(train_loader, detected_class_names, sampling_profile)
    if sampler is not None:
        print("Using metadata-weighted sampling for training split.")
        train_loader = DataLoader(
            train_loader.dataset,
            batch_size=batch_size,
            sampler=sampler,
            num_workers=num_workers,
        )
    else:
        print("Using standard shuffled sampling for training split.")

    model = get_model(num_classes=num_classes).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    best_model_wts = copy.deepcopy(model.state_dict())
    best_acc = -1.0
    best_model_path = os.path.join(output_dir, "best_model.pth")

    for epoch in range(num_epochs):
        print(f"Epoch {epoch + 1}/{num_epochs}")
        print("-" * 10)

        for phase in ["train", "val"]:
            if phase == "train":
                model.train()
                dataloader = train_loader
            else:
                model.eval()
                dataloader = val_loader

            running_loss = 0.0
            running_corrects = 0

            for inputs, labels in dataloader:
                inputs = inputs.to(device)
                labels = labels.to(device)
                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == "train"):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == "train":
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

            epoch_loss = running_loss / len(dataloader.dataset)
            epoch_acc = running_corrects.double() / len(dataloader.dataset)
            print(f"{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}")

            if phase == "val" and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = copy.deepcopy(model.state_dict())
                torch.save(model.state_dict(), best_model_path)
                print(f"New best model saved with Acc: {best_acc:.4f}")

    print(f"Best val Acc: {best_acc:.4f}")
    model.load_state_dict(best_model_wts)
    torch.save(model.state_dict(), best_model_path)

    calibration = _compute_calibration(
        _collect_validation_records(model, val_loader, device),
        detected_class_names,
        list(getattr(val_loader.dataset, "sample_metadata", [])),
        default_threshold=calibration_default_threshold,
        min_threshold=calibration_min_threshold,
        max_threshold=calibration_max_threshold,
        margin_floor=calibration_margin_floor,
    )

    model_version = os.getenv("MODEL_VERSION") or f"rw-finetuned-mobilenetv2-{time.strftime('%Y%m%d')}"
    metadata_path = _write_labels_metadata(
        output_dir,
        os.path.basename(best_model_path),
        class_names=detected_class_names,
        crop_type=crop_type,
        source_dirs=source_dirs,
        data_dir=data_dirs or data_dir,
        best_val_acc=float(best_acc),
        model_version=model_version,
        manifest_path=manifest_path,
        manifest_images_root=manifest_images_root,
        calibration=calibration,
        sampling_profile=sampling_profile,
        split_seed=split_seed,
    )
    print(f"Saved label metadata: {metadata_path}")
    return model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Leaf Disease Classification Model (bean or maize)")
    parser.add_argument("--data_dir", type=str, default=None, help="Path to one dataset root (class folders inside)")
    parser.add_argument(
        "--data_dirs",
        type=str,
        default=None,
        help="Comma-separated dataset roots for combined training (e.g. bean_root,maize_root)",
    )
    parser.add_argument("--manifest_path", type=str, default=None, help="CSV manifest path for metadata-aware fine-tuning")
    parser.add_argument(
        "--manifest_images_root",
        type=str,
        default=None,
        help="Optional root folder where manifest image paths are resolved first",
    )
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--output_dir", type=str, default=".", help="Directory to save model")
    parser.add_argument(
        "--class_names",
        type=str,
        default=None,
        help="Optional comma-separated class names/folder names to enforce label order",
    )
    parser.add_argument("--num_workers", type=int, default=0, help="DataLoader workers")
    parser.add_argument("--sampling_profile", type=str, default=None, help="JSON file with metadata weighting profile")
    parser.add_argument("--split_seed", type=int, default=42, help="Random seed for train/val/test split")
    parser.add_argument(
        "--calibration_default_threshold",
        type=float,
        default=0.65,
        help="Fallback confidence threshold used when calibration has little data",
    )
    parser.add_argument(
        "--calibration_min_threshold",
        type=float,
        default=0.5,
        help="Minimum confidence threshold clamp during calibration",
    )
    parser.add_argument(
        "--calibration_max_threshold",
        type=float,
        default=0.92,
        help="Maximum confidence threshold clamp during calibration",
    )
    parser.add_argument(
        "--calibration_margin_floor",
        type=float,
        default=0.08,
        help="Minimum top-1/top-2 margin threshold used for uncertainty checks",
    )

    args = parser.parse_args()
    parsed_data_dirs = _parse_paths_arg(args.data_dirs)

    if args.manifest_path and (args.data_dir or parsed_data_dirs):
        parser.error("Use --manifest_path alone, or use --data_dir/--data_dirs.")
    if not args.manifest_path and not args.data_dir and not parsed_data_dirs:
        parser.error("Provide --manifest_path, or --data_dir, or --data_dirs")
    if parsed_data_dirs and args.class_names:
        parser.error("--class_names is not supported with --data_dirs combined training")

    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)

    train_model(
        args.data_dir,
        args.epochs,
        args.batch_size,
        args.lr,
        args.output_dir,
        class_names=_parse_class_names_arg(args.class_names),
        num_workers=args.num_workers,
        data_dirs=parsed_data_dirs,
        manifest_path=args.manifest_path,
        manifest_images_root=args.manifest_images_root,
        sampling_profile_path=args.sampling_profile,
        split_seed=args.split_seed,
        calibration_default_threshold=args.calibration_default_threshold,
        calibration_min_threshold=args.calibration_min_threshold,
        calibration_max_threshold=args.calibration_max_threshold,
        calibration_margin_floor=args.calibration_margin_floor,
    )
