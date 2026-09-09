"""
Train lightweight classifiers for:
  1. Eye State (OPEN / CLOSED)  — SVM on EAR features
  2. Head Pose direction         — SVM on yaw/pitch/roll features
  3. Attention Score             — Rule-based (no training needed)

Models are saved as .pkl files and loaded by vision.py at runtime.
No GPU, no large dataset, runs in < 30 seconds.
"""
import os
import sys
import pickle
import numpy as np
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import classification_report

# Add parent dir so we can import generate_data
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_data import generate_eye_state_data, generate_head_pose_data

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def train_eye_state_classifier():
    print("\n=== Training Eye State Classifier ===")
    X, y = generate_eye_state_data(n_samples=3000)
    
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(
            kernel="rbf",
            C=10.0,
            gamma="scale",
            probability=True,
            class_weight="balanced",
            random_state=42
        ))
    ])
    
    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring="f1_macro")
    print(f"CV F1-macro: {scores.mean():.3f} ± {scores.std():.3f}")
    
    # Train on all data
    pipeline.fit(X, y)
    
    # Quick eval on held-out slice
    from sklearn.model_selection import train_test_split
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=0, stratify=y)
    pipeline2 = Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(kernel="rbf", C=10.0, gamma="scale", probability=True, class_weight="balanced", random_state=42))
    ])
    pipeline2.fit(X_tr, y_tr)
    y_pred = pipeline2.predict(X_te)
    print(classification_report(y_te, y_pred, target_names=["OPEN", "CLOSED"]))
    
    # Save final model trained on everything
    model_path = os.path.join(MODELS_DIR, "eye_state_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"Saved: {model_path}")
    return pipeline


def train_head_pose_classifier():
    print("\n=== Training Head Pose Classifier ===")
    X, y = generate_head_pose_data(n_samples=4000)
    
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(
            kernel="rbf",
            C=20.0,
            gamma="scale",
            probability=True,
            class_weight="balanced",
            random_state=42
        ))
    ])
    
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_val_score(pipeline, X, y, cv=cv, scoring="f1_macro")
    print(f"CV F1-macro: {scores.mean():.3f} ± {scores.std():.3f}")
    
    pipeline.fit(X, y)
    
    model_path = os.path.join(MODELS_DIR, "head_pose_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(pipeline, f)
    print(f"Saved: {model_path}")
    return pipeline


def train_attention_regressor():
    """
    Train a lightweight attention score predictor.
    Input features: [head_pose_label, gaze_label, eye_state, drowsiness, ear]
    Output: attention_score (0-100)
    """
    print("\n=== Training Attention Score Regressor ===")
    from sklearn.ensemble import GradientBoostingRegressor
    
    rng = np.random.default_rng(7)
    n = 5000
    
    # Simulate features
    head_forward = rng.integers(0, 2, n)  # 1=forward, 0=away
    gaze_center = rng.integers(0, 2, n)   # 1=center, 0=away
    eyes_open = rng.integers(0, 2, n)     # 1=open, 0=closed
    ear = rng.uniform(0.05, 0.45, n)
    drowsy = (ear < 0.18).astype(int)
    
    # Rule-based ground truth (what we want the model to learn)
    score = np.full(n, 100.0)
    score -= (1 - head_forward) * rng.uniform(15, 25, n)  # head away penalty
    score -= (1 - gaze_center) * rng.uniform(8, 18, n)    # gaze away penalty
    score -= (1 - eyes_open) * rng.uniform(20, 30, n)     # eyes closed penalty
    score -= drowsy * rng.uniform(10, 20, n)              # drowsy penalty
    score += rng.normal(0, 3, n)                          # noise
    score = np.clip(score, 0, 100)
    
    X = np.column_stack([head_forward, gaze_center, eyes_open, ear, drowsy])
    y = score
    
    model = GradientBoostingRegressor(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        subsample=0.8, random_state=42
    )
    model.fit(X, y)
    
    # Evaluate
    from sklearn.model_selection import cross_val_score
    r2 = cross_val_score(model, X, y, cv=5, scoring="r2")
    print(f"Attention R² = {r2.mean():.3f} ± {r2.std():.3f}")
    
    model_path = os.path.join(MODELS_DIR, "attention_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    print(f"Saved: {model_path}")
    return model


if __name__ == "__main__":
    print("=" * 50)
    print("AI Classroom — Model Training Pipeline")
    print("=" * 50)
    print("Training 3 lightweight models on synthetic data...")
    print("(~2000-5000 samples each, SVM + GBR, no GPU needed)")
    
    eye_model = train_eye_state_classifier()
    pose_model = train_head_pose_classifier()
    attn_model = train_attention_regressor()
    
    print("\n" + "=" * 50)
    print("ALL MODELS TRAINED SUCCESSFULLY")
    print(f"Saved to: {MODELS_DIR}/")
    print("  eye_state_model.pkl")
    print("  head_pose_model.pkl")
    print("  attention_model.pkl")
    print("=" * 50)
    print("\nNow start the backend: uvicorn app.main:app --reload")
