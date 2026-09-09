"""
One-shot setup script for AI Classroom Backend.
Run from inside: d:\AttentionSys\backend (with venv activated)

  python setup.py

This will:
  1. Install all dependencies
  2. Train the 3 ML models
  3. Seed the database (if Supabase is configured)
  4. Print next steps
"""
import subprocess
import sys
import os

def run(cmd, check=True):
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True, check=check)
    return result.returncode == 0

def main():
    print("=" * 60)
    print("  AI Classroom Monitor — Setup")
    print("=" * 60)

    # 1. Install deps
    print("\n[1/3] Installing dependencies...")
    run(f"{sys.executable} -m pip install -r requirements.txt --quiet")

    # 2. Train models
    print("\n[2/3] Training ML models (eye state, head pose, attention)...")
    try:
        result = subprocess.run(
            [sys.executable, "train/train_models.py"],
            capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print("[WARN] Model training output:", result.stderr)
    except Exception as e:
        print(f"[WARN] Could not run trainer: {e}")

    # 3. Seed DB
    print("\n[3/3] Attempting database seed...")
    try:
        result = subprocess.run(
            [sys.executable, "seed.py"],
            capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print("[WARN] Seed error (DB not connected?):", result.stderr[:300])
    except Exception as e:
        print(f"[WARN] Could not seed DB: {e}")

    print("\n" + "=" * 60)
    print("  SETUP COMPLETE — Next Steps:")
    print("=" * 60)
    print("  Start backend:  uvicorn app.main:app --reload")
    print("  Start frontend: cd ../frontend && npm run dev")
    print("  Open:           http://localhost:5173")
    print("=" * 60)

if __name__ == "__main__":
    main()
