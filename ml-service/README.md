# Bean Disease Classification Service

This service provides image classification for bean leaf diseases (Healthy, Bean Rust, Angular Leaf Spot) using MobileNetV2.

## Project Structure

```
ml-service/
├── app/
│   ├── api.py          # FastAPI endpoint
│   ├── inference.py    # Prediction logic & recommendations
│   └── __init__.py
├── model/
│   ├── dataset.py      # Data loading & splitting
│   ├── model.py        # MobileNetV2 model definition
│   ├── train.py        # Training script
│   ├── evaluate.py     # Evaluation script
│   └── __init__.py
├── requirements.txt    # Dependencies
└── README.md           # Instructions
```

## Setup

1. **Install Dependencies**
   ```bash
   pip install -r ml-service/requirements.txt
   ```

2. **Data Preparation**
   Ensure your dataset is located at `ml-models/bean-dataset` with the following structure:
   ```
   ml-models/bean-dataset/
   ├── healthy/
   ├── bean_rust/
   └── angular_leaf_spot/
   ```

## Training

Optional (recommended): create deterministic `train/val/test` split once:

```bash
cd ml-service
python model/split_dataset.py --data_dir "../ml-models/bean-dataset" --output_dir "../ml-models/bean-dataset-split" --overwrite
```

To train the model:

```bash
cd ml-service
python model/train.py --data_dir "../ml-models/bean-dataset-split" --epochs 10 --batch_size 32
```
This will save the best model to `./best_model.pth`.

## Evaluation

To evaluate the trained model:

```bash
python model/evaluate.py --model_path "best_model.pth" --data_dir "../ml-models/bean-dataset-split"
```
Check `confusion_matrix.png` for results.

## Serving (API)

To start the FastAPI server:

```bash
cd ml-service
uvicorn app.api:app --reload
```
The API will be available at `http://localhost:8000`.

### API Usage

**Endpoint:** `POST /predict`

**Example Request (cURL):**
```bash
curl -X POST "http://localhost:8000/predict" -F "file=@/path/to/bean_leaf.jpg"
```

**Response:**
```json
{
  "label": "bean_rust",
  "confidence": 0.95,
  "recommendation": "Bean Rust detected..."
}
```
