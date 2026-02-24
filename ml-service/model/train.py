import argparse
import copy
import json
import os
import time
from collections import Counter

import torch
import torch.nn as nn
import torch.optim as optim

try:
    from dataset import get_dataloaders
    from model import get_model
except ImportError:  # pragma: no cover - supports `python -m model.train`
    from .dataset import get_dataloaders
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


def _write_labels_metadata(output_dir, model_file_name, *, class_names, crop_type, source_dirs, data_dir, best_val_acc):
    model_stem, _ = os.path.splitext(model_file_name)
    metadata_path = os.path.join(output_dir, f"{model_stem}.labels.json")
    payload = {
        "class_names": list(class_names),
        "crop_type": crop_type,
        "labels": _prefixed_labels(class_names, crop_type),
        "source_dirs": list(source_dirs or []),
        "best_val_accuracy": float(best_val_acc),
        "saved_at_epoch_time": int(time.time()),
    }
    if isinstance(data_dir, (list, tuple)):
        payload["data_dirs"] = [os.path.abspath(path) for path in data_dir]
    else:
        payload["data_dir"] = os.path.abspath(data_dir)
    with open(metadata_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    return metadata_path


def train_model(
    data_dir,
    num_epochs=10,
    batch_size=32,
    learning_rate=0.001,
    output_dir=".",
    class_names=None,
    num_workers=0,
    data_dirs=None,
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # 1. Data Preparation
    train_loader, val_loader, _ = get_dataloaders(
        data_dir=data_dir,
        batch_size=batch_size,
        num_workers=num_workers,
        class_names=class_names,
        data_dirs=data_dirs,
    )

    # Read discovered class metadata from the dataset (works for bean or maize).
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

    # Calculate class weights from the actual training split to handle imbalance.
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
    for i in range(num_classes):
        count = class_counts.get(i, 0)
        if count > 0:
            w = total_samples / (num_classes * count)
        else:
            w = 1.0
        weights.append(w)

    class_weights = torch.FloatTensor(weights).to(device)
    print(f"Class weights: {weights}")

    # 2. Model Setup
    model = get_model(num_classes=num_classes).to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    # 3. Training Loop
    best_model_wts = copy.deepcopy(model.state_dict())
    best_acc = 0.0
    best_model_path = os.path.join(output_dir, "best_model.pth")

    for epoch in range(num_epochs):
        print(f'Epoch {epoch+1}/{num_epochs}')
        print('-' * 10)

        # Each epoch has a training and validation phase
        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
                dataloader = train_loader
            else:
                model.eval()
                dataloader = val_loader

            running_loss = 0.0
            running_corrects = 0

            # Iterate over data
            for inputs, labels in dataloader:
                inputs = inputs.to(device)
                labels = labels.to(device)

                # Zero the parameter gradients
                optimizer.zero_grad()

                # Forward
                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    # Backward + optimize only if in training phase
                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                # Statistics
                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

            epoch_loss = running_loss / len(dataloader.dataset)
            epoch_acc = running_corrects.double() / len(dataloader.dataset)

            print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')

            # Deep copy the model
            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = copy.deepcopy(model.state_dict())
                torch.save(model.state_dict(), best_model_path)
                metadata_path = _write_labels_metadata(
                    output_dir,
                    os.path.basename(best_model_path),
                    class_names=detected_class_names,
                    crop_type=crop_type,
                    source_dirs=source_dirs,
                    data_dir=data_dirs or data_dir,
                    best_val_acc=float(best_acc),
                )
                print(f"New best model saved with Acc: {best_acc:.4f}")
                print(f"Saved label metadata: {metadata_path}")

    print(f'Best val Acc: {best_acc:4f}')

    # Load best model weights
    model.load_state_dict(best_model_wts)
    return model

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train Leaf Disease Classification Model (bean or maize)')
    parser.add_argument('--data_dir', type=str, default=None, help='Path to one dataset root (class folders inside)')
    parser.add_argument(
        '--data_dirs',
        type=str,
        default=None,
        help='Comma-separated dataset roots for combined training (e.g. bean_root,maize_root)',
    )
    parser.add_argument('--epochs', type=int, default=10, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--lr', type=float, default=0.001, help='Learning rate')
    parser.add_argument('--output_dir', type=str, default='.', help='Directory to save model')
    parser.add_argument(
        '--class_names',
        type=str,
        default=None,
        help='Optional comma-separated class names/folder names to enforce label order',
    )
    parser.add_argument('--num_workers', type=int, default=0, help='DataLoader workers')

    args = parser.parse_args()

    parsed_data_dirs = _parse_paths_arg(args.data_dirs)
    if not args.data_dir and not parsed_data_dirs:
        parser.error("Provide --data_dir or --data_dirs")
    if args.data_dir and parsed_data_dirs:
        parser.error("Use either --data_dir or --data_dirs, not both")

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
    )
