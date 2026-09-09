"""
Data generation for eye state classifier.
Generates synthetic EAR (Eye Aspect Ratio) feature vectors
labeled as OPEN or CLOSED — no large external dataset required.
"""
import numpy as np
import pickle
import os

def generate_eye_state_data(n_samples=2000, seed=42):
    """
    EAR Distribution (empirically validated):
      OPEN  eyes: EAR ~ 0.25 - 0.42 (mean ~0.33)
      CLOSED eyes: EAR ~ 0.05 - 0.19 (mean ~0.12)
    
    Features per sample: [ear, ear_left, ear_right, ear_diff, blink_velocity]
    """
    rng = np.random.default_rng(seed)
    
    X, y = [], []
    
    # Class 0: OPEN
    for _ in range(n_samples // 2):
        ear = rng.normal(loc=0.33, scale=0.05)
        ear = np.clip(ear, 0.22, 0.48)
        ear_l = ear + rng.normal(0, 0.02)
        ear_r = ear + rng.normal(0, 0.02)
        ear_diff = abs(ear_l - ear_r)
        velocity = rng.uniform(0, 0.02)  # stable
        X.append([ear, ear_l, ear_r, ear_diff, velocity])
        y.append(0)  # OPEN
    
    # Class 1: CLOSED
    for _ in range(n_samples // 2):
        ear = rng.normal(loc=0.12, scale=0.04)
        ear = np.clip(ear, 0.02, 0.22)
        ear_l = ear + rng.normal(0, 0.02)
        ear_r = ear + rng.normal(0, 0.02)
        ear_diff = abs(ear_l - ear_r)
        velocity = rng.uniform(0.04, 0.15)  # fast movement
        X.append([ear, ear_l, ear_r, ear_diff, velocity])
        y.append(1)  # CLOSED
    
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)


def generate_head_pose_data(n_samples=3000, seed=99):
    """
    Head pose classification from yaw/pitch/roll angles.
    Classes: FORWARD=0, LEFT=1, RIGHT=2, UP=3, DOWN=4
    
    Features: [yaw, pitch, roll, abs_yaw, abs_pitch]
    """
    rng = np.random.default_rng(seed)
    X, y = [], []
    
    def add(yaw, pitch, roll, label, n, noise=5):
        for _ in range(n):
            yr = yaw + rng.normal(0, noise)
            pr = pitch + rng.normal(0, noise)
            rr = roll + rng.normal(0, noise / 2)
            X.append([yr, pr, rr, abs(yr), abs(pr)])
            y.append(label)
    
    per = n_samples // 5
    add(yaw=0,   pitch=0,   roll=0,    label=0, n=per, noise=10)  # FORWARD
    add(yaw=-30, pitch=0,   roll=0,    label=1, n=per, noise=8)   # LEFT
    add(yaw=30,  pitch=0,   roll=0,    label=2, n=per, noise=8)   # RIGHT
    add(yaw=0,   pitch=-20, roll=0,    label=3, n=per, noise=8)   # UP
    add(yaw=0,   pitch=20,  roll=0,    label=4, n=per, noise=8)   # DOWN
    
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)


if __name__ == "__main__":
    print("Generating synthetic training data...")
    X_eye, y_eye = generate_eye_state_data(2000)
    X_pose, y_pose = generate_head_pose_data(3000)
    
    os.makedirs("train/data", exist_ok=True)
    
    with open("train/data/eye_state_data.pkl", "wb") as f:
        pickle.dump({"X": X_eye, "y": y_eye}, f)
    
    with open("train/data/head_pose_data.pkl", "wb") as f:
        pickle.dump({"X": X_pose, "y": y_pose}, f)
    
    print(f"Eye state: {len(X_eye)} samples")
    print(f"Head pose: {len(X_pose)} samples")
    print("Data saved to train/data/")
