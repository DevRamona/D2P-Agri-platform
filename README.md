# D2P Agri Platform (IsokoLink)

This repository contains the D2P Agri platform with a new production-ready feature: `Crop Disease Scanner`.

Farmers can:
- Scan maize/bean leaves using a real webcam feed in the browser
- Upload one or more images for disease analysis
- Get disease predictions from a Python FastAPI inference service
- Request personalized recommendations from an LLM (OpenAI-compatible API)

## Services

- `frontend` (Vite + React + TypeScript): UI for camera capture, upload, results, language toggle
- `backend` (Express): `POST /api/disease/analyze` and `POST /api/disease/recommendations`
- `ml-service` (FastAPI): `POST /predict` for image inference (mock or real model mode)

## Crop Disease Scanner Overview

### Frontend (`/farmer/quality-scan`)
- Real webcam stream (`MediaDevices.getUserMedia`)
- Camera capture flow: Start Camera, Capture, Retake, Analyze
- Upload flow: multiple images, thumbnails, remove selection
- Optional live mode (off by default) with interval + Stop button
- Results panel for each image:
  - crop type
  - disease label
  - confidence
  - summary
  - quality warnings
  - latency
- LLM recommendations button with English / Kinyarwanda toggle

### Backend API
- `POST /api/disease/analyze`
  - multipart `images[]`, `cropHint`, `mode`
  - proxies to FastAPI ML service
  - validates image type/count/size
  - rate-limited
  - does not persist images by default
- `POST /api/disease/generate`
  - multipart `images[]`, `cropHint`, `mode`
  - uses PaliGemma LoRA adapter in `ml-service` to return generated diagnosis + recommendation
  - rate-limited
- `POST /api/disease/recommendations`
  - JSON payload
  - calls OpenAI-compatible LLM endpoint
  - returns structured Markdown recommendations

### ML Inference Service
- `POST /predict` (multipart, multiple images)
- `MOCK_MODEL=true` (default) deterministic predictions for development
- `MOCK_MODEL=false` enables a generic TorchScript adapter (configure `MODEL_PATH` + `MODEL_LABELS`)
- Image quality checks (too dark / blurry) returned as warnings

## Prerequisites

- Node.js 18+ (recommended)
- Python 3.10+ (tested syntax on Python 3.14)
- MongoDB (for the existing auth/app features)

## 1) Backend Setup (Express API)

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
DB_URL=mongodb://localhost:27017/d2p-agri
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Crop Disease Scanner
ML_SERVICE_URL=http://localhost:8000
ML_SERVICE_TIMEOUT_MS=15000

# LLM (OpenAI-compatible)
LLM_API_KEY=your_key
LLM_MODEL=gpt-4.1-mini
LLM_BASE_URL=https://api.openai.com/v1
# Optional: override if your provider uses a different path
# LLM_CHAT_COMPLETIONS_PATH=/chat/completions
LLM_TIMEOUT_MS=20000
LLM_TEMPERATURE=0.3
LLM_LOW_CONFIDENCE_THRESHOLD=0.65

# Buyer Payments (Flutterwave Mobile Money + Stripe Card)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST_xxx_or_live_secret
FLUTTERWAVE_SECRET_HASH=flutterwave_webhook_secret_hash
FLUTTERWAVE_API_BASE_URL=https://api.flutterwave.com/v3
BACKEND_PUBLIC_URL=https://your-backend-domain
FRONTEND_PUBLIC_URL=https://your-frontend-domain

# Card checkout fallback (Stripe)
STRIPE_SECRET_KEY=sk_live_or_sk_test_key
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CURRENCY=rwf
STRIPE_CHECKOUT_SUCCESS_URL=https://your-frontend-domain/buyer/order-tracking?orderId={ORDER_ID}&checkout=success&session_id={CHECKOUT_SESSION_ID}
STRIPE_CHECKOUT_CANCEL_URL=https://your-frontend-domain/buyer/order-review?orderId={ORDER_ID}&checkout=cancelled

# Optional local testing only
ALLOW_MOBILE_MONEY_STUB=false

# Upload persistence (privacy-first defaults)
SAVE_UPLOADS=false
UPLOAD_STORAGE_BACKEND=local
DISEASE_UPLOAD_DIR=uploads/disease-scans

# Optional feedback storage placeholder
SAVE_FEEDBACK=false
FEEDBACK_DIR=data/feedback
```

Run backend:

```bash
npm run dev
```

Backend API docs:

```text
Swagger UI: http://localhost:4000/docs
OpenAPI JSON: http://localhost:4000/docs/openapi.json
```

## 2) ML Service Setup (FastAPI)

```bash
cd ml-service
python -m pip install -r requirements.txt
```

Run in mock mode (default):

```bash
set MOCK_MODEL=true
python -m uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

PowerShell (persistent for session):

```powershell
$env:MOCK_MODEL="true"
python -m uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

## 3) Frontend Setup (Vite)

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
# Optional local testing toggles (defaults are false)
VITE_ENABLE_STUB_MOBILE_MONEY=false
VITE_ENABLE_BANK_TRANSFER=false
```

Run frontend:

```bash
npm run dev
```

Open the app and navigate to the farmer `Quality Scan` page.

## Testing

### Frontend build check

```bash
cd frontend
npm run build
```

### Backend test (disease analyze schema)

```bash
cd backend
npx jest tests/disease.test.js --runInBand
```

### FastAPI test (multiple image predict)

```bash
cd ml-service
python -m pip install pytest httpx
python -m pytest tests/test_api.py
```

## Testing with Sample Images

- Use any `jpg/png` leaf image (maize or bean)
- Camera tab: start camera, capture, analyze
- Upload tab: select up to 5 images (max 5MB each), analyze
- Click `Get Recommendations` to call the configured LLM

## cURL Examples

### Backend: Analyze Images

```bash
curl -X POST "http://localhost:4000/api/disease/analyze" ^
  -F "images=@C:\path\to\leaf1.jpg" ^
  -F "images=@C:\path\to\leaf2.jpg" ^
  -F "cropHint=auto" ^
  -F "mode=upload"
```

PowerShell:

```powershell
curl.exe -X POST "http://localhost:4000/api/disease/analyze" `
  -F "images=@C:\path\to\leaf1.jpg" `
  -F "cropHint=maize" `
  -F "mode=camera"
```

### Backend: LLM Recommendations

```bash
curl -X POST "http://localhost:4000/api/disease/recommendations" ^
  -H "Content-Type: application/json" ^
  -d "{\"cropType\":\"maize\",\"disease\":\"common_rust\",\"confidence\":0.82,\"location\":\"Rwanda\",\"season\":\"Season B\",\"farmerGoal\":\"protect yield\",\"language\":\"en\"}"
```

### ML Service: Predict (direct)

```bash
curl -X POST "http://localhost:8000/predict" ^
  -F "images=@C:\path\to\leaf1.jpg" ^
  -F "images=@C:\path\to\leaf2.jpg" ^
  -F "cropHint=auto" ^
  -F "mode=upload"
```

## Swapping Mock Mode with a Real Trained Model

The FastAPI service is already wired for a real model adapter.

1. Export a TorchScript model that returns logits for your labels.
2. Set:
   - `MOCK_MODEL=false`
   - `MODEL_PATH=/absolute/path/to/model.pt`
   - `MODEL_LABELS=maize:healthy,maize:common_rust,maize:gray_leaf_spot,bean:healthy,bean:bean_rust,...`
   - `MODEL_VERSION=your-model-version`
3. Keep the output logits order aligned exactly with `MODEL_LABELS`.
4. Restart `ml-service`.

If your model is not TorchScript, replace `TorchDiseaseModel` in `ml-service/app/inference.py` with your framework adapter (TensorFlow/PyTorch eager) while preserving the `BaseDiseaseModel` interface:
- `load_model()`
- `preprocess(image)`
- `predict(imageTensor)`

## Privacy / Security Notes

- Images are not persisted by default (`SAVE_UPLOADS=false`)
- Upload validation: PNG/JPG only, max 5 images, max 5MB each
- Disease endpoints are rate-limited
- The disease feature does not intentionally log request bodies or PII
