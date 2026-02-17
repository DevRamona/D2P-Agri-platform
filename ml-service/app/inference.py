import torch
import cv2
import numpy as np
from PIL import Image
import os
import sys

# Add parent directory to path to import model modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from model.model import get_model
from model.dataset import get_transforms, CLASS_NAMES

# Recommendations
RECOMMENDATIONS = {
    'healthy': "Great news! Your plant looks healthy. Continue with regular care, ensuring proper watering and sunlight. Monitor for any changes.",
    'bean_rust': "Bean Rust detected. Recommendations: Remove infected leaves immediately. Avoid overhead watering to reduce moisture on leaves. Consider using approved fungicide if severe.",
    'angular_leaf_spot': "Angular Leaf Spot detected. Recommendations: Maintain proper spacing between plants for air circulation. Remove and destroy infected plant debris. Practice crop rotation for the next season."
}

class DiseaseClassifier:
    def __init__(self, model_path, device=None):
        self.device = device if device else torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = get_model(num_classes=len(CLASS_NAMES))
        
        if os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Model loaded from {model_path}")
        else:
            print(f"Warning: Model path {model_path} does not exist. Using initialized weights (random).")
        
        self.model.to(self.device)
        self.model.eval()
        self.transform = get_transforms(is_train=False)

    def check_quality(self, image_np):
        """
        Check image quality: brightness and blurriness.
        Returns:
            status (str): 'ok', 'too_dark', 'too_blurry'
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        
        # Check brightness
        mean_brightness = np.mean(gray)
        if mean_brightness < 40: # Threshold for darkness
            return "too_dark"
        
        # Check blurriness using Laplacian variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        if laplacian_var < 100: # Threshold for blur
            return "too_blurry"
            
        return "ok"

    def predict(self, image_file, top_k=2):
        """
        Predict disease from image file (file-like object or path).
        """
        try:
            # Load image
            if isinstance(image_file, str):
                image = Image.open(image_file).convert('RGB')
            else:
                image = Image.open(image_file).convert('RGB')
            
            # Quality Check
            image_np = np.array(image)
            quality_status = self.check_quality(image_np)
            if quality_status != "ok":
                return {
                    "label": "image_quality_issue",
                    "confidence": 0.0,
                    "recommendation": f"Image is {quality_status.replace('_', ' ')}. Please upload a clearer photo."
                }

            # Preprocess
            input_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            # Inference
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.nn.functional.softmax(outputs, dim=1)
                
            # Get top prediction
            top_prob, top_idx = torch.max(probabilities, 1)
            confidence = top_prob.item()
            pred_idx = top_idx.item()
            label = CLASS_NAMES[pred_idx]
            
            # If low confidence, maybe return top-2?
            # User request: "top-2 predictions if confidence < 0.60"
            if confidence < 0.60:
                # Get top 2
                top2_prob, top2_idx = torch.topk(probabilities, 2)
                results = []
                for i in range(2):
                    idx = top2_idx[0][i].item()
                    prob = top2_prob[0][i].item()
                    results.append({
                        "label": CLASS_NAMES[idx],
                        "confidence": prob,
                        "recommendation": RECOMMENDATIONS[CLASS_NAMES[idx]]
                    })
                return {
                    "label": "uncertain",
                    "confidence": confidence,
                    "recommendation": "Uncertain prediction. Here are the top possibilities.",
                    "top_predictions": results
                }
            
            return {
                "label": label,
                "confidence": confidence,
                "recommendation": RECOMMENDATIONS[label]
            }
            
        except Exception as e:
            return {
                "label": "error",
                "confidence": 0.0,
                "recommendation": f"Error processing image: {str(e)}"
            }
