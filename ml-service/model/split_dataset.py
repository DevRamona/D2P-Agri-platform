import argparse
import os
import random
import shutil

from dataset import CLASS_NAMES

VALID_EXTS = {'.jpg', '.jpeg', '.png'}

def list_images(class_dir):
    images = []
    for entry in sorted(os.scandir(class_dir), key=lambda e: e.name.lower()):
        if not entry.is_file():
            continue
        if os.path.splitext(entry.name)[1].lower() in VALID_EXTS:
            images.append(entry.path)
    return images

def ensure_dirs(base_output):
    for split in ('train', 'val', 'test'):
        for class_name in CLASS_NAMES:
            os.makedirs(os.path.join(base_output, split, class_name), exist_ok=True)

def clear_output(base_output):
    if os.path.exists(base_output):
        shutil.rmtree(base_output)

def split_class_images(images, train_ratio, val_ratio):
    n = len(images)
    train_n = int(n * train_ratio)
    val_n = int(n * val_ratio)
    test_n = n - train_n - val_n
    train = images[:train_n]
    val = images[train_n:train_n + val_n]
    test = images[train_n + val_n:train_n + val_n + test_n]
    return train, val, test

def copy_split(images, out_dir):
    for src in images:
        dst = os.path.join(out_dir, os.path.basename(src))
        shutil.copy2(src, dst)

def create_split(data_dir, output_dir, train_ratio=0.7, val_ratio=0.15, seed=42, overwrite=False):
    if train_ratio <= 0 or val_ratio <= 0 or train_ratio + val_ratio >= 1:
        raise ValueError("Invalid split ratios. Use train>0, val>0 and train+val<1.")

    if overwrite:
        clear_output(output_dir)

    ensure_dirs(output_dir)

    rng = random.Random(seed)
    split_counts = {
        'train': {},
        'val': {},
        'test': {}
    }

    for class_name in CLASS_NAMES:
        class_dir = os.path.join(data_dir, class_name)
        if not os.path.isdir(class_dir):
            raise FileNotFoundError(f"Missing class folder: {class_dir}")

        images = list_images(class_dir)
        rng.shuffle(images)
        train_imgs, val_imgs, test_imgs = split_class_images(images, train_ratio, val_ratio)

        copy_split(train_imgs, os.path.join(output_dir, 'train', class_name))
        copy_split(val_imgs, os.path.join(output_dir, 'val', class_name))
        copy_split(test_imgs, os.path.join(output_dir, 'test', class_name))

        split_counts['train'][class_name] = len(train_imgs)
        split_counts['val'][class_name] = len(val_imgs)
        split_counts['test'][class_name] = len(test_imgs)

    return split_counts

def main():
    parser = argparse.ArgumentParser(description="Create deterministic train/val/test split for bean dataset")
    parser.add_argument('--data_dir', required=True, help='Path to source dataset (class folders)')
    parser.add_argument('--output_dir', required=True, help='Path to write split dataset')
    parser.add_argument('--train_ratio', type=float, default=0.7, help='Train split ratio')
    parser.add_argument('--val_ratio', type=float, default=0.15, help='Validation split ratio')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--overwrite', action='store_true', help='Delete output_dir before writing split')
    args = parser.parse_args()

    counts = create_split(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        seed=args.seed,
        overwrite=args.overwrite,
    )

    print("Split complete.")
    for split in ('train', 'val', 'test'):
        total = sum(counts[split].values())
        print(f"{split}: total={total}, counts={counts[split]}")

if __name__ == '__main__':
    main()
