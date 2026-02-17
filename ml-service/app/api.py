from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import shutil
import os
import io

from inference import DiseaseClassifier

app = FastAPI(title="Bean Disease Classification API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Classifier
# Assuming model is saved in ../model/best_model.pth after training
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'best_model.pth')
classifier = DiseaseClassifier(MODEL_PATH)

@app.get("/")
def read_root():
    return {"message": "Bean Disease Classification API is running."}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
    
    # Read image content
    contents = await file.read()
    image_stream = io.BytesIO(contents)
    
    result = classifier.predict(image_stream)
    
    return result

if __name__ == '__main__':
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
