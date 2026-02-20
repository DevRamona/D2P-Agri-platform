import torch
import torch.nn as nn
from torchvision import models

def get_model(num_classes=3, pretrained=True):
    """
    Returns a MobileNetV2 model adapted for the specific number of classes.
    """
    # Load MobileNetV2
    weights = models.MobileNet_V2_Weights.DEFAULT if pretrained else None
    model = models.mobilenet_v2(weights=weights)
    
    # Freeze feature extractor layers (optional, but good for small datasets to prevent overfitting)
    # Let's freeze the first few layers or just fine-tune everything with a low learning rate.
    # For now, we'll keep them trainable but users can freeze if needed.
    # To freeze:
    # for param in model.features.parameters():
    #     param.requires_grad = False
    
    # Replace the classifier head
    # MobileNetV2 classifier structure:
    # (classifier): Sequential(
    #   (0): Dropout(p=0.2, inplace=False)
    #   (1): Linear(in_features=1280, out_features=1000, bias=True)
    # )
    
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    
    return model
