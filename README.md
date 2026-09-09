# AI Classroom — Intelligent Attention Monitoring

## Architecture
```
React (Frontend)
    ↕ WebSocket (base64 frames / JSON results)
FastAPI (Backend)
    ↓
MediaPipe FaceMesh (Landmarks)
    ↓
Trained ML Models (Eye State SVM, Head Pose SVM, Attention GBR)
    ↓
Supabase PostgreSQL (session persistence)
```

---

## Trained Models

| Model | Algorithm | Training Data | Accuracy |
|---|---|---|---|
| Eye State | SVM (RBF) | 3,000 synthetic EAR samples | ~98% CV F1 |
| Head Pose | SVM (RBF) | 4,000 synthetic angle samples | ~97% CV F1 |
| Attention Score | Gradient Boosting | 5,000 synthetic samples | R²>0.99 |

Models are trained on synthetic data derived from empirically validated EAR distributions.
No large external dataset is required.

---

## Setup & Run

### 1. Backend — First Time Setup

```powershell
cd d:\AttentionSys\backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# One-shot: installs deps + trains models + seeds DB
python setup.py
```

### 2. Start Backend
```powershell
cd d:\AttentionSys\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload
```
Verify: `http://localhost:8000/health`

### 3. Start Frontend (new terminal)
```powershell
cd d:\AttentionSys\frontend
npm install
npm run dev
```
Open: `http://localhost:5173`

---

## Demo Flow
1. Open `http://localhost:5173`
2. Click **"Continue with Google"** (bypass login for MVP)
3. Click **"Start Monitoring"** → accept Privacy modal
4. **Demo Mode**: instant 10-student simulation
5. **Real Camera**: switch mode toggle BEFORE starting → webcam opens → MediaPipe detects faces
6. End session → Session Report → Export CSV
7. Analytics tab → historical session comparison

---

## Computer Vision Pipeline (Real Camera Mode)
1. React captures webcam frame (640×480) every 500ms
2. Frame encoded to base64 JPEG and sent via WebSocket to FastAPI
3. FastAPI decodes frame → runs `vision.py`:
   - **MediaPipe FaceMesh** detects up to 15 faces with 478 landmarks
   - **PnP Algorithm** computes yaw/pitch/roll from 6 facial reference points
   - **Trained SVM** classifies head pose direction
   - **EAR** (Eye Aspect Ratio) calculated from 6 landmarks per eye
   - **Trained SVM** classifies eye state (OPEN/CLOSED)
   - **Iris landmarks** used for approximate gaze direction
   - **Drowsiness** detected by counting consecutive CLOSED frames
   - **Trained GBR** predicts attention score (0–100)
   - Temporal smoothing applied over last 5 frames per student
4. Annotated JPEG + JSON events sent back via WebSocket
5. React renders annotated frame + updates all metrics in real time

---

## Privacy
- No facial recognition or biometric storage
- No raw video stored
- Anonymous ephemeral IDs ("Student 01") expire when session ends
- Scores are behavioral approximations, not medical/academic assessments

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError: pydantic_settings` | Run `.\venv\Scripts\activate` first, then `pip install -r requirements.txt` |
| Login fails | Already bypassed — just click the button |
| Real Camera: no faces detected | Ensure good lighting, face camera directly |
| WebSocket refused | Start backend first with `uvicorn app.main:app --reload` |
