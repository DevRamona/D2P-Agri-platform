import os
import argparse
import copy
import time
import torch
import torch.nn as nn
import torch.optim as optim
from collections import Counter
import numpy as np

from dataset import get_dataloaders, CLASS_NAMES
from model import get_model

def get_class_weights(dataset, device):
    """
    Calculate class weights to handle imbalance.
    Weight = Total_Samples / (Num_Classes * Class_Samples)
    """
    # Create a full dataset without transforms to just count labels
    # We can't easily iterate the random_split subsets without loading everything.
    # But we can access the underlying dataset and indices if we really want to be precise on the training set.
    # For simplicity, let's just count the whole dataset or just the training subset.
    
    # Since we don't have the subset object here directly, let's assume we can scan the folders again or just iterate the loader once.
    # Iterating the loader is safer.
    print("Calculating class weights from training data...")
    targets = []
    # Using a temporary loader just for counting if needed, or better, calculate in dataset.py.
    # But since we are here, let's just traverse the directory structure assuming it follows the training split roughly? 
    # No, that's wrong.
    
    # Let's count from the train_loader passed in?
    # No, that consumes the iterator. 
    
    # Let's just use 1.0 for now or implement a robust counter.
    # Given the constraint to keep it simple, I'll add a placeholder or optional argument.
    # But the user specifically asked for it. 
    
    # Let's iterate the train_loader once.
    # It might take a moment but it's correct.
    # Actually, we can just look at dataset.samples in the underlying dataset?
    # But we split it randomly.
    
    # Let's skip auto-calculation for this script to keep it fast, 
    # but allow passing weights or assume balanced enough for now, 
    # OR implement a quick pass if requested.
    # User said "Handle class imbalance".
    
    # Let's use a simple heuristic: standard weights. 
    # Note: If valid/test are drawn effectively efficiently, we can just use equal weights if the dataset is roughly balanced.
    # If not, we should probably output the counts.
    
    return None

def train_model(data_dir, num_epochs=10, batch_size=32, learning_rate=0.001, output_dir='.'):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # 1. Data Preparation
    train_loader, val_loader, _ = get_dataloaders(data_dir, batch_size=batch_size)
    
    # Calculate simple class weights from the full dataset samples just to be safe?
    # Accessing the underlying dataset from the loader
    full_dataset = train_loader.dataset.subset.dataset
    indices = train_loader.dataset.subset.indices
    all_labels = [full_dataset.samples[i][1] for i in indices]
    class_counts = Counter(all_labels)
    total_samples = len(all_labels)
    num_classes = len(CLASS_NAMES)
    
    print(f"Training distribution: {dict(class_counts)}")
    
    weights = []
    for i in range(num_classes):
        count = class_counts.get(i, 0)
        if count > 0:
            w = total_samples / (num_classes * count)
        else:
            w = 1.0 # Should not happen if data exists
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
                torch.save(model.state_dict(), os.path.join(output_dir, 'best_model.pth'))
                print(f"New best model saved with Acc: {best_acc:.4f}")

    print(f'Best val Acc: {best_acc:4f}')
    
    # Load best model weights
    model.load_state_dict(best_model_wts)
    return model

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train Bean Disease Classification Model')
    parser.add_argument('--data_dir', type=str, required=True, help='Path to dataset')
    parser.add_argument('--epochs', type=int, default=10, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=32, help='Batch size')
    parser.add_argument('--lr', type=float, default=0.001, help='Learning rate')
    parser.add_argument('--output_dir', type=str, default='.', help='Directory to save model')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.output_dir):
        os.makedirs(args.output_dir)
        
    train_model(args.data_dir, args.epochs, args.batch_size, args.lr, args.output_dir)
