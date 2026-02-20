import os
import torch
from PIL import Image
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms

CLASS_NAMES = ['healthy', 'bean_rust', 'angular_leaf_spot']
CLASS_TO_IDX = {name: idx for idx, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {idx: name for name, idx in CLASS_TO_IDX.items()}
VALID_EXTS = {'.jpg', '.jpeg', '.png'}

class BeanLeafDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        
        for class_name in CLASS_NAMES:
            class_dir = os.path.join(root_dir, class_name)
            if not os.path.isdir(class_dir):
                print(f"Warning: Directory {class_dir} not found. Ensure dataset structure is correct.")
                continue
                
            for entry in sorted(os.scandir(class_dir), key=lambda e: e.name.lower()):
                if not entry.is_file():
                    continue
                if os.path.splitext(entry.name)[1].lower() in VALID_EXTS:
                    self.samples.append((entry.path, CLASS_TO_IDX[class_name]))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"Error loading image {img_path}: {e}")
            image = Image.new('RGB', (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, label

def get_transforms(is_train=True):
    if is_train:
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    else:
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

def _has_split_structure(data_dir):
    for split in ('train', 'val', 'test'):
        split_dir = os.path.join(data_dir, split)
        if not os.path.isdir(split_dir):
            return False
        for class_name in CLASS_NAMES:
            if not os.path.isdir(os.path.join(split_dir, class_name)):
                return False
    return True

def _build_split_dataloaders(data_dir, batch_size=32, num_workers=0):
    train_data = BeanLeafDataset(
        root_dir=os.path.join(data_dir, 'train'),
        transform=get_transforms(is_train=True)
    )
    val_data = BeanLeafDataset(
        root_dir=os.path.join(data_dir, 'val'),
        transform=get_transforms(is_train=False)
    )
    test_data = BeanLeafDataset(
        root_dir=os.path.join(data_dir, 'test'),
        transform=get_transforms(is_train=False)
    )

    train_loader = DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=num_workers)
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    test_loader = DataLoader(test_data, batch_size=batch_size, shuffle=False, num_workers=num_workers)
    return train_loader, val_loader, test_loader

def get_dataloaders(data_dir, batch_size=32, num_workers=0):
    if _has_split_structure(data_dir):
        return _build_split_dataloaders(data_dir, batch_size=batch_size, num_workers=num_workers)

    full_dataset = BeanLeafDataset(root_dir=data_dir, transform=None)

    total_size = len(full_dataset)
    train_size = int(0.7 * total_size)
    val_size = int(0.15 * total_size)
    test_size = total_size - train_size - val_size
    
    train_subset, val_subset, test_subset = random_split(
        full_dataset, [train_size, val_size, test_size], 
        generator=torch.Generator().manual_seed(42)
    )
    
    class TransformSubset(Dataset):
        def __init__(self, subset, transform=None):
            self.subset = subset
            self.transform = transform
            
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
