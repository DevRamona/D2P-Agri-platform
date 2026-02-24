import glob
import os
import random
import re
from collections import defaultdict
from collections.abc import Iterable

import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset, Subset
from torchvision import transforms

# Backward-compatible bean defaults (legacy imports may still rely on these names)
BEAN_CLASS_NAMES = ["healthy", "bean_rust", "angular_leaf_spot"]
MAIZE_CLASS_NAMES = ["healthy", "common_rust", "gray_leaf_spot", "northern_leaf_blight"]
CLASS_NAMES = BEAN_CLASS_NAMES
CLASS_TO_IDX = {name: idx for idx, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {idx: name for name, idx in CLASS_TO_IDX.items()}


CLASS_NAME_ALIASES = {
    # Bean classes
    "healthy": "healthy",
    "bean_rust": "bean_rust",
    "angular_leaf_spot": "angular_leaf_spot",
    # PlantVillage maize folder names / variants
    "Corn_(maize)___healthy": "healthy",
    "Corn_(maize)___Common_rust_": "common_rust",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "gray_leaf_spot",
    "Corn_(maize)___Northern_Leaf_Blight": "northern_leaf_blight",
    "corn_maize_common_rust": "common_rust",
    "corn_maize_cercospora_leaf_spot_gray_leaf_spot": "gray_leaf_spot",
    "corn_maize_northern_leaf_blight": "northern_leaf_blight",
}


def normalize_class_name(raw_name):
    if raw_name in CLASS_NAME_ALIASES:
        return CLASS_NAME_ALIASES[raw_name]

    normalized = raw_name.strip().lower()
    normalized = normalized.replace("&", "and")
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")

    if normalized in CLASS_NAME_ALIASES:
        return CLASS_NAME_ALIASES[normalized]

    # Handle common maize naming variants after generic normalization
    normalized = normalized.replace("corn_maize", "").strip("_")
    normalized = normalized.replace("common_rust_", "common_rust")
    normalized = normalized.replace("northern_leaf_blight_", "northern_leaf_blight")

    return normalized


def infer_crop_type(class_names):
    names = set(class_names)
    if names.issubset(set(BEAN_CLASS_NAMES)):
        return "bean"
    if names.issubset(set(MAIZE_CLASS_NAMES)):
        return "maize"
    return "unknown"


def _preferred_class_order(class_names):
    unique = list(dict.fromkeys(class_names))
    unique_set = set(unique)

    if unique_set.issubset(set(BEAN_CLASS_NAMES)):
        return [name for name in BEAN_CLASS_NAMES if name in unique_set]
    if unique_set.issubset(set(MAIZE_CLASS_NAMES)):
        return [name for name in MAIZE_CLASS_NAMES if name in unique_set]

    return sorted(unique)


def discover_dataset_classes(root_dir, class_names=None):
    if not os.path.isdir(root_dir):
        raise FileNotFoundError(f"Dataset directory not found: {root_dir}")

    directory_entries = []
    for entry_name in os.listdir(root_dir):
        full_path = os.path.join(root_dir, entry_name)
        if os.path.isdir(full_path):
            directory_entries.append(
                {
                    "dir_name": entry_name,
                    "dir_path": full_path,
                    "label": normalize_class_name(entry_name),
                }
            )

    if not directory_entries:
        raise RuntimeError(f"No class directories were found in {root_dir}")

    by_label = defaultdict(list)
    for entry in directory_entries:
        by_label[entry["label"]].append(entry)

    duplicate_labels = [label for label, entries in by_label.items() if len(entries) > 1]
    if duplicate_labels:
        raise RuntimeError(
            f"Multiple folders normalize to the same label in {root_dir}: {duplicate_labels}. "
            "Rename or merge duplicated class folders."
        )

    if class_names:
        normalized_requested = [normalize_class_name(name) for name in class_names]
        missing = [name for name in normalized_requested if name not in by_label]
        if missing:
            raise RuntimeError(f"Requested classes not found in dataset: {missing}")
        ordered_labels = normalized_requested
    else:
        ordered_labels = _preferred_class_order([entry["label"] for entry in directory_entries])

    selected_entries = [by_label[label][0] for label in ordered_labels]
    return selected_entries, ordered_labels


def _iter_unique_image_paths(entry_dir):
    seen_paths = set()
    for ext in ["*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG", "*.webp", "*.WEBP"]:
        image_paths = glob.glob(os.path.join(entry_dir, ext))
        for img_path in sorted(image_paths):
            normalized_path = os.path.normcase(os.path.normpath(img_path))
            if normalized_path in seen_paths:
                continue
            seen_paths.add(normalized_path)
            yield img_path


class LeafDiseaseDataset(Dataset):
    def __init__(self, root_dir, transform=None, class_names=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []

        selected_entries, discovered_class_names = discover_dataset_classes(root_dir, class_names=class_names)
        self.class_names = discovered_class_names
        self.class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}
        self.idx_to_class = {idx: name for name, idx in self.class_to_idx.items()}
        self.crop_type = infer_crop_type(self.class_names)
        self.source_dirs = [entry["dir_name"] for entry in selected_entries]

        for entry in selected_entries:
            label_idx = self.class_to_idx[entry["label"]]
            for img_path in _iter_unique_image_paths(entry["dir_path"]):
                self.samples.append((img_path, label_idx))

        if not self.samples:
            raise RuntimeError(f"No images found in dataset directory: {root_dir}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            print(f"Error loading image {img_path}: {exc}")
            image = Image.new("RGB", (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, label


# Backward-compatible alias
BeanLeafDataset = LeafDiseaseDataset


class MultiCropLeafDiseaseDataset(Dataset):
    def __init__(self, root_dirs, transform=None):
        if not isinstance(root_dirs, Iterable) or isinstance(root_dirs, (str, bytes)):
            raise TypeError("root_dirs must be an iterable of dataset directories")

        self.root_dirs = [str(path) for path in root_dirs if str(path).strip()]
        if not self.root_dirs:
            raise RuntimeError("At least one dataset directory is required for multi-crop training")

        self.transform = transform
        self.samples = []
        self.class_names = []
        self.source_dirs = []
        self.crop_type = "mixed"

        self.class_to_idx = {}
        self.idx_to_class = {}

        for root_dir in self.root_dirs:
            selected_entries, discovered_class_names = discover_dataset_classes(root_dir)
            crop_type = infer_crop_type(discovered_class_names)
            if crop_type not in {"bean", "maize"}:
                raise RuntimeError(
                    f"Could not infer crop type for dataset '{root_dir}'. "
                    "Expected bean or maize class names/folders.",
                )

            for entry in selected_entries:
                disease_name = entry["label"]
                prefixed_label = f"{crop_type}:{disease_name}"
                if prefixed_label not in self.class_to_idx:
                    class_index = len(self.class_names)
                    self.class_names.append(prefixed_label)
                    self.class_to_idx[prefixed_label] = class_index
                    self.idx_to_class[class_index] = prefixed_label

                label_idx = self.class_to_idx[prefixed_label]
                self.source_dirs.append(f"{crop_type}:{entry['dir_name']}")
                for img_path in _iter_unique_image_paths(entry["dir_path"]):
                    self.samples.append((img_path, label_idx))

        if not self.samples:
            raise RuntimeError(f"No images found in dataset directories: {self.root_dirs}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            print(f"Error loading image {img_path}: {exc}")
            image = Image.new("RGB", (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, label


def get_transforms(is_train=True):
    if is_train:
        return transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomRotation(15),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ]
        )

    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


def _build_stratified_splits(samples, train_ratio=0.7, val_ratio=0.15, seed=42):
    by_label = defaultdict(list)
    for index, (_, label) in enumerate(samples):
        by_label[label].append(index)

    rng = random.Random(seed)
    train_indices = []
    val_indices = []
    test_indices = []

    for _, indices in by_label.items():
        rng.shuffle(indices)
        n = len(indices)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        n_test = n - n_train - n_val

        # Ensure non-empty val/test when the class has enough samples.
        if n >= 3:
            if n_val == 0:
                n_val = 1
                n_train = max(1, n_train - 1)
            if n_test == 0:
                n_test = 1
                n_train = max(1, n_train - 1)

        train_indices.extend(indices[:n_train])
        val_indices.extend(indices[n_train : n_train + n_val])
        test_indices.extend(indices[n_train + n_val : n_train + n_val + n_test])

    rng.shuffle(train_indices)
    rng.shuffle(val_indices)
    rng.shuffle(test_indices)

    return train_indices, val_indices, test_indices


def get_dataloaders(data_dir=None, batch_size=32, num_workers=0, class_names=None, data_dirs=None):
    if data_dirs:
        if class_names:
            raise RuntimeError(
                "class_names override is not supported with data_dirs multi-crop training. "
                "Use discovered class folders for each dataset root.",
            )
        full_dataset = MultiCropLeafDiseaseDataset(root_dirs=data_dirs, transform=None)
    else:
        if not data_dir:
            raise RuntimeError("data_dir is required when data_dirs is not provided")
        full_dataset = LeafDiseaseDataset(root_dir=data_dir, transform=None, class_names=class_names)
    train_indices, val_indices, test_indices = _build_stratified_splits(full_dataset.samples)

    train_subset = Subset(full_dataset, train_indices)
    val_subset = Subset(full_dataset, val_indices)
    test_subset = Subset(full_dataset, test_indices)

    class TransformSubset(Dataset):
        def __init__(self, subset, transform=None):
            self.subset = subset
            self.transform = transform
            self.class_names = subset.dataset.class_names
            self.class_to_idx = subset.dataset.class_to_idx
            self.idx_to_class = subset.dataset.idx_to_class
            self.crop_type = subset.dataset.crop_type
            self.source_dirs = subset.dataset.source_dirs

        def __getitem__(self, idx):
            x, y = self.subset[idx]
            if self.transform:
                x = self.transform(x)
            return x, y

        def __len__(self):
            return len(self.subset)

    train_data = TransformSubset(train_subset, transform=get_transforms(is_train=True))
    val_data = TransformSubset(val_subset, transform=get_transforms(is_train=False))
    test_data = TransformSubset(test_subset, transform=get_transforms(is_train=False))

    train_loader = DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader = DataLoader(test_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    return train_loader, val_loader, test_loader
