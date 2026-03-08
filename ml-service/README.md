# Crop Disease ML Service

This service runs CNN-based disease classification for bean and maize leaf images and exposes a FastAPI inference API.

## What Is Implemented

- MobileNetV2 transfer learning (`model/model.py`)
- Training for:
  - folder datasets (`--data_dir`)
  - multi-root datasets (`--data_dirs`)
  - metadata-aware Rwanda fine-tuning (`--manifest_path`)
- Calibration export in sidecar metadata (`best_model.labels.json`):
  - confidence thresholds by label and crop
  - margin threshold
  - metadata group accuracy snapshots
- Inference-time confidence gating:
  - emits `disease: "uncertain"` when confidence/margin gates fail
  - returns `candidateDisease` and `topPredictions`

## Structure

```text
ml-service/
  app/
    api.py
    inference.py
  model/
    dataset.py
    finetune_dataset.py
    model.py
    train.py
    evaluate.py
    rwanda_manifest_template.csv
    rwanda_finetune_profile.example.json
```

## Setup

```bash
pip install -r ml-service/requirements.txt
```

## Training

### 1) Standard folder training

```bash
cd ml-service
python model/train.py --data_dir "../ml-models/bean-dataset" --epochs 10 --batch_size 32
```

### 2) Combined bean + maize roots

```bash
python model/train.py --data_dirs "../ml-models/bean-dataset,../ml-models/maize-dataset" --epochs 12 --batch_size 32
```

### 3) Rwanda metadata-aware fine-tuning

Prepare a CSV like `model/rwanda_manifest_template.csv`, then:

```bash
python model/train.py \
  --manifest_path "../ml-models/rwanda_manifest.csv" \
  --manifest_images_root "../ml-models" \
  --sampling_profile "model/rwanda_finetune_profile.example.json" \
  --epochs 12 \
  --batch_size 32
```

## Evaluation

### Folder dataset

```bash
python model/evaluate.py --model_path "best_model.pth" --data_dir "../ml-models/bean-dataset"
```

### Manifest dataset

```bash
python model/evaluate.py \
  --model_path "best_model.pth" \
  --manifest_path "../ml-models/rwanda_manifest.csv" \
  --manifest_images_root "../ml-models"
```

## Serving API

```bash
cd ml-service
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

`POST /predict` accepts up to 5 images and returns per-image:
- `cropType`
- `disease`
- `candidateDisease`
- `confidence`
- `isUncertain`
- `uncertaintyReasons`
- `topPredictions`

`POST /generate` accepts up to 5 images and returns LoRA-generated response fields:
- `diagnosis`
- `recommendation`
- `generatedText`
- `disease`
- `cropType`
- `modelVersion`

Environment variables for `/generate`:
- `PALIGEMMA_ADAPTER_DIR` (default: `model/paligemma-rwanda-lora`)
- `PALIGEMMA_BASE_MODEL` (default: `google/paligemma2-3b-pt-448`)
- `PALIGEMMA_BASE_MODEL_PATH` (optional local snapshot path)
- `PALIGEMMA_ALLOW_REMOTE` (`true/false`, default `false`)
- `PALIGEMMA_MAX_NEW_TOKENS` (default `180`)

## Backend Integration Notes

- The backend should treat `disease === "uncertain"` as a retake/confirm state.
- `candidateDisease` can still be passed to recommendation generation for conservative guidance.
