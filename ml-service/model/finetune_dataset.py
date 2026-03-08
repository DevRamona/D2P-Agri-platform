import csv
import os
import random
import re
from collections import defaultdict

from PIL import Image
from torch.utils.data import DataLoader, Dataset, Subset

try:
    from dataset import BEAN_CLASS_NAMES, MAIZE_CLASS_NAMES, get_transforms, normalize_class_name
except ImportError:  # pragma: no cover - supports `python -m model.train`
    from .dataset import BEAN_CLASS_NAMES, MAIZE_CLASS_NAMES, get_transforms, normalize_class_name


def normalize_crop_name(value):
    normalized = str(value or "").strip().lower()
    if normalized in {"bean", "beans"}:
        return "bean"
    if normalized in {"maize", "corn", "corn_maize"}:
        return "maize"
    return normalized


def normalize_season(value):
    normalized = str(value or "").strip().lower().replace("-", " ").replace("_", " ")
    if not normalized:
        return None
    if normalized in {"a", "season a", "seasona"}:
        return "season_a"
    if normalized in {"b", "season b", "seasonb"}:
        return "season_b"
    if normalized in {"c", "season c", "seasonc"}:
        return "season_c"
    return re.sub(r"\s+", "_", normalized)


def _normalize_text(value):
    normalized = str(value or "").strip().lower()
    return normalized if normalized else None


def normalize_label(label, *, crop_type=None, disease=None):
    raw = str(label or "").strip()
    if ":" in raw:
        crop_name, disease_name = raw.split(":", 1)
        crop_name = normalize_crop_name(crop_name)
        disease_name = normalize_class_name(disease_name)
        if crop_name in {"bean", "maize"}:
            return f"{crop_name}:{disease_name}"
        return disease_name

    crop_name = normalize_crop_name(crop_type)
    disease_name = normalize_class_name(disease if disease is not None else raw)
    if crop_name in {"bean", "maize"}:
        return f"{crop_name}:{disease_name}"
    return disease_name


def _label_sort_key(label):
    crop_order = {"bean": 0, "maize": 1}
    bean_order = {name: idx for idx, name in enumerate(BEAN_CLASS_NAMES)}
    maize_order = {name: idx for idx, name in enumerate(MAIZE_CLASS_NAMES)}

    if ":" in label:
        crop_name, disease_name = label.split(":", 1)
        crop_name = normalize_crop_name(crop_name)
        if crop_name == "bean":
            return (crop_order[crop_name], bean_order.get(disease_name, 99), disease_name)
        if crop_name == "maize":
            return (crop_order[crop_name], maize_order.get(disease_name, 99), disease_name)
        return (9, 99, label)

    if label in bean_order:
        return (0, bean_order[label], label)
    if label in maize_order:
        return (1, maize_order[label], label)
    return (9, 99, label)


def _resolve_image_path(raw_path, *, manifest_dir, images_root):
    image_ref = str(raw_path or "").strip()
    if not image_ref:
        return None

    if os.path.isabs(image_ref):
        return image_ref

    if images_root:
        candidate = os.path.join(images_root, image_ref)
        if os.path.exists(candidate):
            return candidate

    return os.path.join(manifest_dir, image_ref)


def _build_metadata(row):
    return {
        "country": _normalize_text(row.get("country")) or "rwanda",
        "province": _normalize_text(row.get("province")),
        "district": _normalize_text(row.get("district")),
        "sector": _normalize_text(row.get("sector")),
        "season": normalize_season(row.get("season")),
        "rainfall_band": _normalize_text(row.get("rainfall_band") or row.get("rainfall")),
        "agro_zone": _normalize_text(row.get("agro_zone") or row.get("agro_ecological_zone")),
        "capture_mode": _normalize_text(row.get("capture_mode")),
        "source": _normalize_text(row.get("source")),
        "crop_type": normalize_crop_name(row.get("crop_type") or row.get("crop")),
    }


class ManifestLeafDiseaseDataset(Dataset):
    def __init__(self, manifest_path, transform=None, class_names=None, images_root=None):
        self.manifest_path = manifest_path
        self.transform = transform
        self.samples = []
        self.sample_metadata = []
        self.source_dirs = [f"manifest:{os.path.basename(manifest_path)}"]

        if not os.path.exists(manifest_path):
            raise FileNotFoundError(f"Manifest not found: {manifest_path}")

        manifest_dir = os.path.dirname(os.path.abspath(manifest_path))
        resolved_images_root = os.path.abspath(images_root) if images_root else None
        label_index = defaultdict(list)

        with open(manifest_path, "r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise RuntimeError(f"Manifest has no headers: {manifest_path}")

            for row_number, row in enumerate(reader, start=2):
                image_path = _resolve_image_path(
                    row.get("image_path") or row.get("path") or row.get("image"),
                    manifest_dir=manifest_dir,
                    images_root=resolved_images_root,
                )
                if not image_path:
                    raise RuntimeError(f"Row {row_number}: missing image_path/path/image")
                if not os.path.exists(image_path):
                    raise RuntimeError(f"Row {row_number}: image not found: {image_path}")

                label = normalize_label(
                    row.get("label"),
                    crop_type=row.get("crop_type") or row.get("crop"),
                    disease=row.get("disease"),
                )
                if not label:
                    raise RuntimeError(
                        f"Row {row_number}: label is empty. Provide label or crop_type+disease columns.",
                    )

                label_index[label].append((image_path, _build_metadata(row)))

        discovered_labels = sorted(label_index.keys(), key=_label_sort_key)
        if class_names:
            normalized_requested = [normalize_label(name) for name in class_names]
            missing = [name for name in normalized_requested if name not in label_index]
            if missing:
                raise RuntimeError(f"Requested classes not found in manifest: {missing}")
            self.class_names = normalized_requested
        else:
            self.class_names = discovered_labels

        self.class_to_idx = {name: idx for idx, name in enumerate(self.class_names)}
        self.idx_to_class = {idx: name for name, idx in self.class_to_idx.items()}

        crop_prefixes = set()
        for label in self.class_names:
            if ":" in label:
                crop_prefixes.add(label.split(":", 1)[0])
        normalized_prefixes = {normalize_crop_name(value) for value in crop_prefixes}
        if normalized_prefixes == {"bean"}:
            self.crop_type = "bean"
        elif normalized_prefixes == {"maize"}:
            self.crop_type = "maize"
        elif normalized_prefixes:
            self.crop_type = "mixed"
        else:
            self.crop_type = "unknown"

        for class_name in self.class_names:
            label_id = self.class_to_idx[class_name]
            for image_path, metadata in sorted(label_index[class_name], key=lambda item: item[0]):
                self.samples.append((image_path, label_id))
                self.sample_metadata.append(metadata)

        if not self.samples:
            raise RuntimeError(f"No samples loaded from manifest: {manifest_path}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        image_path, label = self.samples[idx]
        try:
            image = Image.open(image_path).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            print(f"Error loading image {image_path}: {exc}")
            image = Image.new("RGB", (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)
        return image, label


class _TransformSubset(Dataset):
    def __init__(self, subset, transform=None):
        self.subset = subset
        self.transform = transform
        self.class_names = subset.dataset.class_names
        self.class_to_idx = subset.dataset.class_to_idx
        self.idx_to_class = subset.dataset.idx_to_class
        self.crop_type = subset.dataset.crop_type
        self.source_dirs = subset.dataset.source_dirs

        source_metadata = getattr(subset.dataset, "sample_metadata", [])
        self.sample_metadata = [source_metadata[i] for i in subset.indices] if source_metadata else []

    def __getitem__(self, idx):
        image, label = self.subset[idx]
        if self.transform:
            image = self.transform(image)
        return image, label

    def __len__(self):
        return len(self.subset)


def build_stratified_splits(samples, train_ratio=0.7, val_ratio=0.15, seed=42):
    by_label = defaultdict(list)
    for index, (_, label) in enumerate(samples):
        by_label[label].append(index)

    rng = random.Random(seed)
    train_indices = []
    val_indices = []
    test_indices = []

    for _, indices in by_label.items():
        rng.shuffle(indices)
        total = len(indices)
        n_train = int(total * train_ratio)
        n_val = int(total * val_ratio)
        n_test = total - n_train - n_val

        if total >= 3:
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


def get_manifest_dataloaders(
    manifest_path,
    *,
    batch_size=32,
    num_workers=0,
    class_names=None,
    images_root=None,
    split_seed=42,
):
    full_dataset = ManifestLeafDiseaseDataset(
        manifest_path=manifest_path,
        transform=None,
        class_names=class_names,
        images_root=images_root,
    )
    train_indices, val_indices, test_indices = build_stratified_splits(
        full_dataset.samples,
        seed=split_seed,
    )

    train_subset = _TransformSubset(Subset(full_dataset, train_indices), transform=get_transforms(is_train=True))
    val_subset = _TransformSubset(Subset(full_dataset, val_indices), transform=get_transforms(is_train=False))
    test_subset = _TransformSubset(Subset(full_dataset, test_indices), transform=get_transforms(is_train=False))

    train_loader = DataLoader(train_subset, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_subset, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader = DataLoader(test_subset, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    return train_loader, val_loader, test_loader


DEFAULT_SAMPLING_PROFILE = {
    "min_weight": 0.6,
    "max_weight": 3.0,
    "season_weights": {"season_a": 1.0, "season_b": 1.2, "season_c": 1.1},
    "province_weights": {"east": 1.15, "west": 1.2, "north": 1.1, "south": 1.05, "kigali": 1.0},
    "rainfall_weights": {"high": 1.2, "moderate": 1.0, "low": 1.1},
    "crop_weights": {"bean": 1.0, "maize": 1.0},
    "disease_weights": {},
    "district_weights": {},
}


def _merge_dict(base, override):
    merged = dict(base)
    for key, value in dict(override or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_sampling_profile(profile_path=None):
    profile = dict(DEFAULT_SAMPLING_PROFILE)
    if not profile_path:
        return profile

    if not os.path.exists(profile_path):
        raise FileNotFoundError(f"Sampling profile not found: {profile_path}")

    import json

    with open(profile_path, "r", encoding="utf-8") as handle:
        user_profile = json.load(handle)
    return _merge_dict(profile, user_profile)


def compute_metadata_sample_weights(sample_metadata, sample_label_names, profile):
    if not sample_metadata or len(sample_metadata) != len(sample_label_names):
        return None

    season_weights = dict(profile.get("season_weights") or {})
    province_weights = dict(profile.get("province_weights") or {})
    rainfall_weights = dict(profile.get("rainfall_weights") or {})
    crop_weights = dict(profile.get("crop_weights") or {})
    disease_weights = dict(profile.get("disease_weights") or {})
    district_weights = dict(profile.get("district_weights") or {})

    min_weight = float(profile.get("min_weight", 0.6))
    max_weight = float(profile.get("max_weight", 3.0))

    weights = []
    for metadata, label in zip(sample_metadata, sample_label_names):
        meta = metadata if isinstance(metadata, dict) else {}

        crop_type = normalize_crop_name(meta.get("crop_type"))
        disease_name = str(label or "").strip().lower()
        province = str(meta.get("province") or "").strip().lower()
        district = str(meta.get("district") or "").strip().lower()
        season = str(meta.get("season") or "").strip().lower()
        rainfall_band = str(meta.get("rainfall_band") or "").strip().lower()

        if ":" in disease_name and crop_type not in {"bean", "maize"}:
            crop_type = disease_name.split(":", 1)[0]
        if ":" not in disease_name and crop_type in {"bean", "maize"}:
            disease_name = f"{crop_type}:{disease_name}"

        weight = 1.0
        weight *= float(crop_weights.get(crop_type, 1.0))
        weight *= float(disease_weights.get(disease_name, 1.0))
        weight *= float(province_weights.get(province, 1.0))
        weight *= float(district_weights.get(district, 1.0))
        weight *= float(season_weights.get(season, 1.0))
        weight *= float(rainfall_weights.get(rainfall_band, 1.0))

        weights.append(max(min_weight, min(max_weight, weight)))
    return weights
