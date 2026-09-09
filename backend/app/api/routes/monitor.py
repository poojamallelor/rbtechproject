from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.vision import process_frame, CV_AVAILABLE, MEDIAPIPE_AVAILABLE
import json

router = APIRouter()

@router.get("/api/v1/monitor/status")
async def get_monitor_status():
    return {
        "status": "ready",
        "cv_available": CV_AVAILABLE,
        "mediapipe_available": MEDIAPIPE_AVAILABLE,
        "endpoint": "/ws/monitor"
    }

@router.websocket("/ws/monitor")
async def monitor_session(websocket: WebSocket):
    await websocket.accept()
    print("[WS] Client connected to Live Monitor")
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            if payload.get("action") == "ping":
                await websocket.send_json({"action": "pong", "status": "active"})
                continue

            if "frame" not in payload:
                await websocket.send_json({"error": "No frame field in payload"})
                continue

            client_faces = payload.get("faces")
            result = process_frame(payload["frame"], client_faces=client_faces)

            if result is None:
                await websocket.send_json({
                    "error": "Frame processing failed",
                    "students_detected": 0,
                    "average_attention": 0,
                    "events": []
                })
            else:
                await websocket.send_json(result)

    except WebSocketDisconnect:
        print("[WS] Client disconnected normally")
    except Exception as e:
        print(f"[WS] Connection error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
