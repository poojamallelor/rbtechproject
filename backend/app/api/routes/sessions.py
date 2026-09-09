"""
Session persistence endpoints.
Stores session summaries in a local JSON file so data survives backend restarts.
Falls back gracefully if file I/O fails.
"""
import os
import json
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

SESSIONS_FILE = os.path.join(os.path.dirname(__file__), "../../../sessions_data.json")


def _load_sessions() -> list:
    try:
        if os.path.exists(SESSIONS_FILE):
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load sessions: {e}")
    return []


def _save_sessions(sessions: list) -> bool:
    try:
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(sessions, f, indent=2)
        return True
    except Exception as e:
        print(f"[WARN] Could not save sessions: {e}")
        return False


@router.post("/sessions/save")
async def save_session(request: Request):
    """Save a completed session summary to persistent storage."""
    try:
        body = await request.json()
        # Inject server-side timestamp if not present
        if "savedAt" not in body:
            body["savedAt"] = datetime.utcnow().isoformat()

        sessions = _load_sessions()
        sessions.insert(0, body)         # newest first
        sessions = sessions[:200]        # cap at 200 sessions
        ok = _save_sessions(sessions)

        return JSONResponse(
            content={"status": "saved" if ok else "error", "count": len(sessions)},
            status_code=200
        )
    except Exception as e:
        print(f"[ERROR] save_session: {e}")
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


@router.get("/sessions/history")
async def get_sessions():
    """Return all persisted session summaries (newest first)."""
    sessions = _load_sessions()
    return JSONResponse(content={"status": "ok", "data": sessions, "count": len(sessions)})


@router.delete("/sessions/clear")
async def clear_sessions():
    """Clear all stored sessions (useful for testing)."""
    ok = _save_sessions([])
    return JSONResponse(content={"status": "cleared" if ok else "error"})
