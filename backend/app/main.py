from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from app.core.config import settings
    PROJECT_NAME = settings.PROJECT_NAME
    VERSION = settings.VERSION
    API_V1_STR = settings.API_V1_STR
except Exception:
    PROJECT_NAME = "AI Classroom Monitor"
    VERSION = "1.0.0"
    API_V1_STR = "/api/v1"

app = FastAPI(
    title=PROJECT_NAME,
    version=VERSION,
    openapi_url=f"{API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
import shutil
from fastapi.responses import FileResponse

DEMO_IMAGE_PATH = r"C:\Users\pooja\.gemini\antigravity-ide\brain\3371251d-4247-43c7-a404-c39315526fec\classroom_students_1788916609404.jpg"

try:
    frontend_public = r"d:\AttentionSys\frontend\public"
    os.makedirs(frontend_public, exist_ok=True)
    target_img = os.path.join(frontend_public, "classroom_demo.jpg")
    if os.path.exists(DEMO_IMAGE_PATH):
        shutil.copyfile(DEMO_IMAGE_PATH, target_img)
        print("[INFO] Copied classroom demo image to frontend/public/classroom_demo.jpg")
except Exception as e:
    print(f"[WARN] Could not copy demo image: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AI Classroom Monitor"}

@app.get("/api/v1/demo/classroom-image")
def get_classroom_demo_image():
    if os.path.exists(DEMO_IMAGE_PATH):
        return FileResponse(DEMO_IMAGE_PATH, media_type="image/jpeg")
    target_img = r"d:\AttentionSys\frontend\public\classroom_demo.jpg"
    if os.path.exists(target_img):
        return FileResponse(target_img, media_type="image/jpeg")
    return {"error": "Demo image not found"}

@app.get("/api/v1/demo/analysis")
def get_classroom_demo_analysis():
    """Returns ground-truth computer vision analysis of the 5 students in classroom_demo.jpg."""
    return {
        "image": "/classroom_demo.jpg",
        "students_detected": 5,
        "class_attention": 68,
        "counts": {
            "attentive": 3,
            "partially_attentive": 1,
            "distracted": 1
        },
        "students": [
            {
                "id": "Student 01",
                "attentionScore": 45,
                "status": "PARTIALLY_ATTENTIVE",
                "headPose": "LEFT",
                "gaze": "LEFT",
                "eyeState": "OPEN",
                "drowsiness": False,
                "box": {"x": 13.0, "y": 40.0, "width": 8.5, "height": 16.5},
                "notes": "Looking out the window on the left instead of professor"
            },
            {
                "id": "Student 02",
                "attentionScore": 91,
                "status": "ATTENTIVE",
                "headPose": "FORWARD",
                "gaze": "CENTER",
                "eyeState": "OPEN",
                "drowsiness": False,
                "box": {"x": 30.5, "y": 40.5, "width": 8.5, "height": 16.5},
                "notes": "Writing lecture notes actively with pen in blue hoodie"
            },
            {
                "id": "Student 03",
                "attentionScore": 96,
                "status": "ATTENTIVE",
                "headPose": "FORWARD",
                "gaze": "CENTER",
                "eyeState": "OPEN",
                "drowsiness": False,
                "box": {"x": 46.5, "y": 38.5, "width": 8.5, "height": 16.5},
                "notes": "Highly attentive student with glasses, facing presentation"
            },
            {
                "id": "Student 04",
                "attentionScore": 89,
                "status": "ATTENTIVE",
                "headPose": "FORWARD",
                "gaze": "CENTER",
                "eyeState": "OPEN",
                "drowsiness": False,
                "box": {"x": 61.5, "y": 39.5, "width": 8.5, "height": 16.5},
                "notes": "Attentive student in yellow sweater listening to lecture"
            },
            {
                "id": "Student 05",
                "attentionScore": 18,
                "status": "DISTRACTED",
                "headPose": "DOWN",
                "gaze": "DOWN",
                "eyeState": "CLOSED",
                "drowsiness": True,
                "box": {"x": 77.0, "y": 49.0, "width": 12.0, "height": 18.0},
                "notes": "Sleeping with head resting down on desk, eyes closed, severe inattention"
            }
        ]
    }

# Auth routes
try:
    from app.api.routes import auth, users
    app.include_router(auth.router, prefix=f"{API_V1_STR}/auth", tags=["auth"])
    app.include_router(users.router, prefix=f"{API_V1_STR}/users", tags=["users"])
except Exception as e:
    print(f"[WARN] Could not load auth/users routes: {e}")

# WebSocket monitor route
try:
    from app.api.routes import monitor
    app.include_router(monitor.router, tags=["monitor"])
except Exception as e:
    print(f"[WARN] Could not load monitor route: {e}")

# Session persistence routes
try:
    from app.api.routes import sessions
    app.include_router(sessions.router, prefix=f"{API_V1_STR}", tags=["sessions"])
except Exception as e:
    print(f"[WARN] Could not load sessions route: {e}")
