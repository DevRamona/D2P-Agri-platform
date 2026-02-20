import os
import argparse
import copy
import torch
import torch.nn as nn
import torch.optim as optim
from collections import Counter

from dataset import get_dataloaders, CLASS_NAMES
from model import get_model

def train_model(data_dir, num_epochs=10, batch_size=32, learning_rate=0.001, output_dir='.'):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    train_loader, val_loader, _ = get_dataloaders(data_dir, batch_size=batch_size)
    
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
            w = 1.0
        weights.append(w)
        
    class_weights = torch.FloatTensor(weights).to(device)
    print(f"Class weights: {weights}")

    model = get_model(num_classes=num_classes).to(device)
    
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    best_model_wts = copy.deepcopy(model.state_dict())
    best_acc = 0.0
    
    for epoch in range(num_epochs):
        print(f'Epoch {epoch+1}/{num_epochs}')
        print('-' * 10)

        for phase in ['train', 'val']:
            if phase == 'train':
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

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)

            epoch_loss = running_loss / len(dataloader.dataset)
            epoch_acc = running_corrects.double() / len(dataloader.dataset)

            print(f'{phase} Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f}')

            if phase == 'val' and epoch_acc > best_acc:
                best_acc = epoch_acc
                best_model_wts = copy.deepcopy(model.state_dict())
                torch.save(model.state_dict(), os.path.join(output_dir, 'best_model.pth'))
                print(f"New best model saved with Acc: {best_acc:.4f}")

    print(f'Best val Acc: {best_acc:4f}')
    
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
