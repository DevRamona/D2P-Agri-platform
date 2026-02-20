import os
import glob
from PIL import Image
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms

# Class mapping
CLASS_NAMES = ['healthy', 'bean_rust', 'angular_leaf_spot']
CLASS_TO_IDX = {name: idx for idx, name in enumerate(CLASS_NAMES)}
IDX_TO_CLASS = {idx: name for name, idx in CLASS_TO_IDX.items()}

class BeanLeafDataset(Dataset):
    def __init__(self, root_dir, transform=None):
        """
        Args:
            root_dir (string): Directory with all the images, structured as:
                               root_dir/healthy/
                               root_dir/bean_rust/
                               root_dir/angular_leaf_spot/
            transform (callable, optional): Optional transform to be applied
                                            on a sample.
        """
        self.root_dir = root_dir
        self.transform = transform
        self.samples = []
        
        # Verify classes and load images
        for class_name in CLASS_NAMES:
            class_dir = os.path.join(root_dir, class_name)
            if not os.path.isdir(class_dir):
                print(f"Warning: Directory {class_dir} not found. Ensure dataset structure is correct.")
                continue
                
            # Find all images (jpg, jpeg, png)
            for ext in ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']:
                image_paths = glob.glob(os.path.join(class_dir, ext))
                for img_path in image_paths:
                    self.samples.append((img_path, CLASS_TO_IDX[class_name]))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"Error loading image {img_path}: {e}")
            # Return a dummy image or handle error appropriately. 
            # For simplicity, let's return the next one or fail carefully.
            # In training, it's often better to skip, but Dataset expects an item.
            # We'll just assume data is largely clean for now.
            image = Image.new('RGB', (224, 224), (0, 0, 0))

        if self.transform:
            image = self.transform(image)

        return image, label

def get_transforms(is_train=True):
    """
    Returns transforms for training or validation/inference.
    Avg stats for ImageNet are usually used for transfer learning:
    mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    """
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

def get_dataloaders(data_dir, batch_size=32, num_workers=0):
    """
    Creates dataloaders for train, val, and test splits (70/15/15).
    """
    full_dataset = BeanLeafDataset(root_dir=data_dir, transform=None) # Transform applied later or wrapper needed if different transforms
    
    # NOTE: To apply different transforms to splits, we need to split indices first, 
    # then create Subsets with different transforms. 
    # However, 'Subset' doesn't support 'transform' override easily without a wrapper.
    # A cleaner way is to instantiate dataset twice or use a wrapper class.
    
    # Calculating split sizes
    total_size = len(full_dataset)
    train_size = int(0.7 * total_size)
    val_size = int(0.15 * total_size)
    test_size = total_size - train_size - val_size
    
    # Reproducible split
    train_subset, val_subset, test_subset = random_split(
        full_dataset, [train_size, val_size, test_size], 
        generator=torch.Generator().manual_seed(42)
    )
    
    # Wrapper to apply transforms dynamically
    class TransformSubset(Dataset):
        def __init__(self, subset, transform=None):
            self.subset = subset
            self.transform = transform
            
        def __getitem__(self, idx):
            x, y = self.subset[idx]
            # x is already a PIL image from BeanLeafDataset.__getitem__ without transform
            # Wait, BeanLeafDataset applies transform if provided. 
            # We initialized full_dataset with transform=None.
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
import torch
