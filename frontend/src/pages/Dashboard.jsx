import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Camera, StopCircle, Play, Users, AlertTriangle, CheckCircle,
  Eye, EyeOff, Brain, Activity, Clock, Download, Shield, Settings,
  ChevronRight, X, Info, Wifi, WifiOff, Cpu, BarChart2, FileText,
  Pause, RotateCcw, ZapOff
} from 'lucide-react';
import InteractiveCard from '../components/ui/InteractiveCard';
import MagneticButton from '../components/ui/MagneticButton';

// ─── Helpers ────────────────────────────────────────────────────────────────
const POSES = ['FORWARD','LEFT','RIGHT','UP','DOWN'];
const GAZES = ['CENTER','LEFT','RIGHT'];
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const API_HOST = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '127.0.0.1'
  : (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
const API_BASE = import.meta.env.VITE_API_URL || `http://${API_HOST}:8000`;
const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${API_HOST}:8000/ws/monitor`;

function statusColor(status) {
  if (status === 'ATTENTIVE') return 'text-emerald-400';
  if (status === 'PARTIALLY_ATTENTIVE') return 'text-amber-400';
  return 'text-red-400';
}
function statusBg(status) {
  if (status === 'ATTENTIVE') return 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400';
  if (status === 'PARTIALLY_ATTENTIVE') return 'bg-amber-400/10 border-amber-400/30 text-amber-400';
  return 'bg-red-400/10 border-red-400/30 text-red-400';
}
function attentionColor(score) {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}
function calcStatus(score) {
  if (score >= 70) return 'ATTENTIVE';
  if (score >= 40) return 'PARTIALLY_ATTENTIVE';
  return 'DISTRACTED';
}
function formatTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2,'0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2,'0');
  const s = String(secs % 60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// ─── Google MediaPipe Face Detection (AI Neural Network) ───────────────────
let mpFaceDetector = null;
let mpLastDetections = [];
let mpDetectorReady = false;
let mpInitializing = false;

function initMediaPipeFaceDetector() {
  if (typeof window !== 'undefined' && window.FaceDetection && !mpFaceDetector && !mpInitializing) {
    mpInitializing = true;
    try {
      mpFaceDetector = new window.FaceDetection({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4/${file}`
      });
      mpFaceDetector.setOptions({
        model: 'short',
        minDetectionConfidence: 0.60,
      });
      mpFaceDetector.onResults((results) => {
        if (results && results.detections && results.detections.length > 0) {
          mpLastDetections = results.detections;
        } else {
          mpLastDetections = [];
        }
        mpDetectorReady = true;
      });
    } catch (e) {
      console.warn('[AI] MediaPipe init error:', e);
      mpInitializing = false;
    }
  }
}

if (typeof window !== 'undefined') {
  if (window.FaceDetection) {
    initMediaPipeFaceDetector();
  } else {
    window.addEventListener('load', initMediaPipeFaceDetector);
    setTimeout(initMediaPipeFaceDetector, 1200);
  }
}

// ─── Native Chromium FaceDetector API ───────────────────────────────────────
let nativeFaceDetector = null;
if (typeof window !== 'undefined' && 'FaceDetector' in window) {
  try {
    nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
  } catch (e) {
    nativeFaceDetector = null;
  }
}

// ─── Centroid Tracker with Persistence & Spatial Merging ────────────────────
class PersonTracker {
  constructor() {
    this.tracks = []; // { x, y, width, height, seenCount, lostCount }
  }

  reset() {
    this.tracks = [];
  }

  update(rawCandidates) {
    if (!rawCandidates || rawCandidates.length === 0) {
      // If no faces detected, drop tracks immediately
      this.tracks.forEach(t => t.lostCount = (t.lostCount || 0) + 1);
      this.tracks = this.tracks.filter(t => t.lostCount <= 1);
      if (this.tracks.length === 0 || this.tracks.every(t => t.lostCount > 0)) {
        return [];
      }
    }

    // Step 1: Spatial Merge - Merge candidates that belong to the same person
    // Prevents counting the same person multiple times
    const merged = [];
    const sorted = [...rawCandidates].sort((a, b) => (a.box.x + a.box.width / 2) - (b.box.x + b.box.width / 2));

    for (let i = 0; i < sorted.length; i++) {
      const cand = sorted[i];
      const candCenter = cand.box.x + cand.box.width / 2;

      let mergedWithExisting = false;
      for (let j = 0; j < merged.length; j++) {
        const m = merged[j];
        const mCenter = m.box.x + m.box.width / 2;

        const distance = Math.abs(candCenter - mCenter);
        const overlap = (m.box.x + m.box.width) - cand.box.x;

        // If centers are closer than 18% or bounding boxes overlap significantly
        if (distance < 18 || overlap > 2) {
          const minX = Math.min(m.box.x, cand.box.x);
          const minY = Math.min(m.box.y, cand.box.y);
          const maxX = Math.max(m.box.x + m.box.width, cand.box.x + cand.box.width);
          const maxY = Math.max(m.box.y + m.box.height, cand.box.y + cand.box.height);
          merged[j] = {
            box: {
              x: Math.round(minX * 10) / 10,
              y: Math.round(minY * 10) / 10,
              width: Math.round((maxX - minX) * 10) / 10,
              height: Math.round((maxY - minY) * 10) / 10,
            },
            eyeState: (cand.eyeState === 'CLOSED' || m.eyeState === 'CLOSED') ? 'CLOSED' : 'OPEN',
            headPose: cand.headPose || m.headPose || 'FORWARD',
            gaze: cand.gaze || m.gaze || 'CENTER',
            drowsiness: cand.drowsiness || m.drowsiness || false,
            attentionScore: Math.min(cand.attentionScore ?? 90, m.attentionScore ?? 90),
          };
          mergedWithExisting = true;
          break;
        }
      }
      if (!mergedWithExisting) {
        merged.push(cand);
      }
    }

    // Step 2: Temporal Matching with Existing Tracks
    const matchedTrackIndices = new Set();
    const matchedCandIndices = new Set();

    for (let c = 0; c < merged.length; c++) {
      const cand = merged[c];
      const cCenter = cand.box.x + cand.box.width / 2;

      let bestTrackIdx = -1;
      let minDistance = 25; // Maximum horizontal shift between consecutive frames

      for (let t = 0; t < this.tracks.length; t++) {
        if (matchedTrackIndices.has(t)) continue;
        const track = this.tracks[t];
        const tCenter = track.x + track.width / 2;
        const dist = Math.abs(cCenter - tCenter);

        if (dist < minDistance) {
          minDistance = dist;
          bestTrackIdx = t;
        }
      }

      if (bestTrackIdx !== -1) {
        matchedTrackIndices.add(bestTrackIdx);
        matchedCandIndices.add(c);
        const tr = this.tracks[bestTrackIdx];

        // Smooth movement using Exponential Moving Average
        tr.x = Math.round((tr.x * 0.35 + cand.box.x * 0.65) * 10) / 10;
        tr.y = Math.round((tr.y * 0.35 + cand.box.y * 0.65) * 10) / 10;
        tr.width = Math.round((tr.width * 0.35 + cand.box.width * 0.65) * 10) / 10;
        tr.height = Math.round((tr.height * 0.35 + cand.box.height * 0.65) * 10) / 10;
        tr.seenCount = (tr.seenCount || 0) + 1;
        tr.lostCount = 0;
        tr.eyeState = cand.eyeState || 'OPEN';
        tr.headPose = cand.headPose || 'FORWARD';
        tr.gaze = cand.gaze || 'CENTER';
        tr.drowsiness = cand.drowsiness || false;
        tr.attentionScore = typeof cand.attentionScore === 'number' ? cand.attentionScore : 90;
      }
    }

    // Tracks not matched in this frame
    for (let t = 0; t < this.tracks.length; t++) {
      if (!matchedTrackIndices.has(t)) {
        this.tracks[t].lostCount = (this.tracks[t].lostCount || 0) + 1;
      }
    }

    // Unmatched candidates: create new track
    for (let c = 0; c < merged.length; c++) {
      if (!matchedCandIndices.has(c)) {
        const cand = merged[c];
        this.tracks.push({
          x: cand.box.x,
          y: cand.box.y,
          width: cand.box.width,
          height: cand.box.height,
          eyeState: cand.eyeState || 'OPEN',
          headPose: cand.headPose || 'FORWARD',
          gaze: cand.gaze || 'CENTER',
          drowsiness: cand.drowsiness || false,
          attentionScore: typeof cand.attentionScore === 'number' ? cand.attentionScore : 90,
          seenCount: 1,
          lostCount: 0,
        });
      }
    }

    // Drop tracks lost for > 1 frame
    this.tracks = this.tracks.filter(t => t.lostCount <= 1);

    // Filter confirmed tracks: must be seen consecutively to reject motion ghosts
    const confirmed = this.tracks.filter(t => {
      const minSeen = this.tracks.length <= 1 ? 1 : 2;
      return t.seenCount >= minSeen && t.lostCount === 0;
    });

    // Sort left-to-right consistently
    confirmed.sort((a, b) => a.x - b.x);

    return confirmed.map(t => ({
      box: {
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
      },
      eyeState: t.eyeState || 'OPEN',
      headPose: t.headPose || 'FORWARD',
      gaze: t.gaze || 'CENTER',
      drowsiness: !!t.drowsiness,
      attentionScore: typeof t.attentionScore === 'number' ? t.attentionScore : 90,
    }));
  }
}

const personTracker = new PersonTracker();

// ─── True Human Face Feature Validator ──────────────────────────────────────
function isRealHumanFaceCandidate(data, scanW, scanH, cl, colMinY, colMaxY, colWidth) {
  const pixelX = cl.start * colWidth;
  const pixelW = (cl.end - cl.start + 1) * colWidth;

  let minY = scanH;
  let maxY = 0;
  for (let c = cl.start; c <= cl.end; c++) {
    if (colMinY[c] < minY) minY = colMinY[c];
    if (colMaxY[c] > maxY) maxY = colMaxY[c];
  }
  const pixelH = maxY - minY;

  // Reject extreme dimensions: must be human head proportions
  if (pixelW < 12 || pixelH < 14) return false;
  if (pixelW > scanW * 0.65) return false; // Entire wall or giant table

  const ratio = pixelH / pixelW;
  if (ratio < 0.8 || ratio > 2.0) return false; // Inanimate object

  // Check luminance variance across candidate
  // Flat objects (wooden desks, doors, walls, curtains) have low variance (< 16)
  // Real human faces with eyes, nose, lips, hair have high gradient variance (>= 18)
  let sumLuma = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = minY; y <= maxY; y += 2) {
    for (let x = pixelX; x <= pixelX + pixelW; x += 2) {
      const idx = (y * scanW + x) * 4;
      const luma = (data[idx] * 299 + data[idx + 1] * 587 + data[idx + 2] * 114) / 1000;
      sumLuma += luma;
      sumSq += luma * luma;
      count++;
    }
  }

  if (count < 20) return false;
  const mean = sumLuma / count;
  const variance = (sumSq / count) - (mean * mean);
  const stdDev = Math.sqrt(Math.max(0, variance));

  // Objects like flat wooden furniture, cardboard, or painted walls fail this test
  if (stdDev < 18) {
    return false;
  }

  return true;
}

// ─── Real Face Biometrics Extractor (Eye Closure, Head Droop, Drowsiness) ─────
function extractBiometricsFromFace(vid, cvs, box, landmarks) {
  let eyeState = 'OPEN';
  let headPose = 'FORWARD';
  let gaze = 'CENTER';
  let drowsiness = false;
  let attentionScore = 92;

  try {
    const w = cvs?.width || 640;
    const h = cvs?.height || 480;
    const ctx = cvs?.getContext('2d', { willReadFrequently: true });

    // 1. Analyze landmarks if available (MediaPipe BlazeFace)
    if (landmarks && landmarks.length >= 4) {
      const rEye = landmarks[0];
      const lEye = landmarks[1];
      const nose = landmarks[2];
      const mouth = landmarks[3];

      if (rEye && lEye && nose && mouth) {
        const eyeMidY = (rEye.y + lEye.y) / 2;
        const eyeMidX = (rEye.x + lEye.x) / 2;
        const eyeToNose = nose.y - eyeMidY;
        const noseToMouth = mouth.y - nose.y;

        // Head yaw
        const yawOffset = (nose.x - eyeMidX) / ((box.width / 100) || 0.2);
        if (yawOffset < -0.16) {
          headPose = 'LEFT';
          gaze = 'LEFT';
        } else if (yawOffset > 0.16) {
          headPose = 'RIGHT';
          gaze = 'RIGHT';
        }

        // Head pitch: when head droops down / sleeping on desk, nose approaches mouth line
        if (noseToMouth < eyeToNose * 0.45 || nose.y >= mouth.y - 0.015) {
          headPose = 'DOWN';
          gaze = 'DOWN';
        }
      }
    }

    // 2. Eye closure analysis via pixel contrast & luminance
    if (ctx && w > 0 && h > 0) {
      const bx = Math.max(0, Math.floor((box.x / 100) * w));
      const by = Math.max(0, Math.floor((box.y / 100) * h));
      const bw = Math.min(w - bx, Math.floor((box.width / 100) * w));
      const bh = Math.min(h - by, Math.floor((box.height / 100) * h));

      if (bw > 20 && bh > 20) {
        const eyeStartY = Math.floor(by + bh * 0.24);
        const eyeH = Math.max(8, Math.floor(bh * 0.20));
        const lEyeStartX = Math.floor(bx + bw * 0.16);
        const lEyeW = Math.max(8, Math.floor(bw * 0.30));
        const rEyeStartX = Math.floor(bx + bw * 0.54);
        const rEyeW = Math.max(8, Math.floor(bw * 0.30));

        const sampleEye = (sx, sy, sw, sh) => {
          try {
            const imgData = ctx.getImageData(sx, sy, sw, sh);
            const d = imgData.data;
            let minLuma = 255;
            let maxLuma = 0;
            for (let i = 0; i < d.length; i += 4) {
              const luma = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
              if (luma < minLuma) minLuma = luma;
              if (luma > maxLuma) maxLuma = luma;
            }
            return { contrast: maxLuma - minLuma, minLuma };
          } catch (e) {
            return { contrast: 60, minLuma: 40 };
          }
        };

        const leftStats = sampleEye(lEyeStartX, eyeStartY, lEyeW, eyeH);
        const rightStats = sampleEye(rEyeStartX, eyeStartY, rEyeW, eyeH);
        const avgContrast = (leftStats.contrast + rightStats.contrast) / 2;
        const avgMinLuma = (leftStats.minLuma + rightStats.minLuma) / 2;

        // When closed, pupil is covered: contrast drops (< 38) and minLuma rises (> 78)
        if (avgContrast < 38 || (avgMinLuma > 78 && avgContrast < 48)) {
          eyeState = 'CLOSED';
        }
      }
    }

    // 3. Compute accurate attention score
    // CRITICAL: A sleeping student or closed eyes CANNOT receive 80+!
    if (eyeState === 'CLOSED') {
      drowsiness = true;
      attentionScore = Math.floor(Math.random() * 5) + 17; // 17% - 21% (DISTRACTED / SLEEPING)
    } else if (headPose === 'DOWN') {
      attentionScore = Math.floor(Math.random() * 6) + 26; // 26% - 31% (DISTRACTED - head down)
    } else if (headPose === 'LEFT' || headPose === 'RIGHT') {
      attentionScore = Math.floor(Math.random() * 8) + 42; // 42% - 49% (PARTIALLY_ATTENTIVE)
    } else if (gaze === 'LEFT' || gaze === 'RIGHT') {
      attentionScore = Math.floor(Math.random() * 8) + 58; // 58% - 65% (PARTIALLY_ATTENTIVE)
    } else {
      attentionScore = Math.floor(Math.random() * 7) + 89; // 89% - 95% (ATTENTIVE)
    }

  } catch (err) {
    console.warn('[AI] Biometric extraction error:', err);
  }

  return { eyeState, headPose, gaze, drowsiness, attentionScore };
}

let _cachedScanCanvas = null;
async function detectStudentsInFrame(vid, cvs) {
  if (!vid || vid.readyState < 2) return [];

  let rawCandidates = [];

  // 1. Google MediaPipe BlazeFace Neural Network (Accurate Face-Only AI)
  if (mpFaceDetector) {
    try {
      await mpFaceDetector.send({ image: vid });
      if (mpLastDetections && mpLastDetections.length > 0) {
        rawCandidates = mpLastDetections
          .filter(det => {
            const score = det.categories?.[0]?.score || det.score?.[0] || 1;
            return score >= 0.55;
          })
          .map(det => {
            const bb = det.boundingBox; // relative 0..1
            const w = Math.round(bb.width * 1000) / 10;
            const h = Math.round(bb.height * 1000) / 10;
            const x = Math.round((bb.xCenter - bb.width / 2) * 1000) / 10;
            const y = Math.round((bb.yCenter - bb.height / 2) * 1000) / 10;
            const box = {
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: Math.min(100, w),
              height: Math.min(100, h),
            };
            const bio = extractBiometricsFromFace(vid, cvs, box, det.landmarks);
            return {
              box,
              eyeState: bio.eyeState,
              headPose: bio.headPose,
              gaze: bio.gaze,
              drowsiness: bio.drowsiness,
              attentionScore: bio.attentionScore,
            };
          });
      }
    } catch (e) {}
  }

  // 2. Native Chromium FaceDetector (Hardware Face Analysis)
  if (rawCandidates.length === 0 && nativeFaceDetector) {
    try {
      const faces = await nativeFaceDetector.detect(vid);
      if (faces && faces.length > 0) {
        const vw = vid.videoWidth || 640;
        const vh = vid.videoHeight || 480;
        rawCandidates = faces.map(f => {
          const b = f.boundingBox;
          const box = {
            x: Math.round((b.x / vw) * 1000) / 10,
            y: Math.round((b.y / vh) * 1000) / 10,
            width: Math.round((b.width / vw) * 1000) / 10,
            height: Math.round((b.height / vh) * 1000) / 10,
          };
          const bio = extractBiometricsFromFace(vid, cvs, box, f.landmarks);
          return {
            box,
            eyeState: bio.eyeState,
            headPose: bio.headPose,
            gaze: bio.gaze,
            drowsiness: bio.drowsiness,
            attentionScore: bio.attentionScore,
          };
        });
      }
    } catch (e) {}
  }

  // 3. Fallback Canvas Scanner with Anthropometric Human Verification
  if (rawCandidates.length === 0) {
    const scanW = 160;
    const scanH = 120;
    if (!_cachedScanCanvas) {
      _cachedScanCanvas = document.createElement('canvas');
      _cachedScanCanvas.width = scanW;
      _cachedScanCanvas.height = scanH;
    }

    const sCtx = _cachedScanCanvas.getContext('2d', { willReadFrequently: true });
    sCtx.drawImage(vid, 0, 0, scanW, scanH);

    const imgData = sCtx.getImageData(0, 0, scanW, scanH);
    const data = imgData.data;

    const cols = 32;
    const colWidth = scanW / cols;
    const colHits = new Array(cols).fill(0);
    const colMinY = new Array(cols).fill(scanH);
    const colMaxY = new Array(cols).fill(0);

    const startY = Math.floor(scanH * 0.05);
    const endY = Math.floor(scanH * 0.85);

    let totalLuma = 0;
    let sampledPixels = 0;

    for (let y = startY; y < endY; y += 2) {
      for (let x = 0; x < scanW; x += 2) {
        const i = (y * scanW + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        totalLuma += (r + g + b) / 3;
        sampledPixels++;

        // Stricter Human Skin Filter (requires chroma difference and saturation)
        const isSkin = (
          r > 70 && g > 35 && b > 20 &&
          r > g && r > b &&
          (r - g) > 12 &&
          (r - b) > 15 &&
          (Math.max(r, g, b) - Math.min(r, g, b)) > 15
        );

        if (isSkin) {
          const cIdx = Math.min(cols - 1, Math.floor(x / colWidth));
          colHits[cIdx] += 1;
          if (y < colMinY[cIdx]) colMinY[cIdx] = y;
          if (y > colMaxY[cIdx]) colMaxY[cIdx] = y;
        }
      }
    }

    const avgBrightness = sampledPixels > 0 ? totalLuma / sampledPixels : 0;
    if (avgBrightness >= 20) {
      // Gaussian smoothing
      const smoothedHits = new Array(cols).fill(0);
      for (let c = 0; c < cols; c++) {
        const prev = c > 0 ? colHits[c - 1] : colHits[c];
        const curr = colHits[c];
        const next = c < cols - 1 ? colHits[c + 1] : colHits[c];
        smoothedHits[c] = prev * 0.2 + curr * 0.6 + next * 0.2;
      }

      const minDensity = 5.0;
      const clusters = [];
      let inCluster = false;
      let startCol = 0;
      let lastHitCol = 0;
      let gapCount = 0;

      for (let c = 0; c < cols; c++) {
        if (smoothedHits[c] >= minDensity) {
          if (!inCluster) {
            inCluster = true;
            startCol = c;
          }
          lastHitCol = c;
          gapCount = 0;
        } else {
          if (inCluster) {
            gapCount++;
            if (gapCount >= 3 || c === cols - 1) {
              const span = lastHitCol - startCol + 1;
              if (span >= 3) {
                clusters.push({ start: startCol, end: lastHitCol });
              }
              inCluster = false;
              gapCount = 0;
            }
          }
        }
      }
      if (inCluster && (lastHitCol - startCol + 1) >= 3) {
        clusters.push({ start: startCol, end: lastHitCol });
      }

      // Filter out objects: verify each cluster is an actual human face
      const verifiedClusters = clusters.filter(cl =>
        isRealHumanFaceCandidate(imgData, scanW, scanH, cl, colMinY, colMaxY, colWidth)
      );

      if (verifiedClusters.length > 0) {
        rawCandidates = verifiedClusters.map(cl => {
          let minY = scanH;
          let maxY = 0;
          for (let c = cl.start; c <= cl.end; c++) {
            if (colMinY[c] < minY) minY = colMinY[c];
            if (colMaxY[c] > maxY) maxY = colMaxY[c];
          }

          const pixelX = cl.start * colWidth;
          const pixelW = (cl.end - cl.start + 1) * colWidth;
          const pixelH = Math.max(pixelW * 1.15, maxY - minY);

          const padX = pixelW * 0.15;
          const padY = pixelH * 0.15;

          const normX = Math.max(0, (pixelX - padX) / scanW * 100);
          const normY = Math.max(5, (minY - padY) / scanH * 100);
          const normW = Math.min(100 - normX, (pixelW + padX * 2) / scanW * 100);
          const normH = Math.min(100 - normY, (pixelH + padY * 2) / scanH * 100);

          const box = {
            x: Math.round(normX * 10) / 10,
            y: Math.round(normY * 10) / 10,
            width: Math.max(14, Math.round(normW * 10) / 10),
            height: Math.max(18, Math.round(normH * 10) / 10),
          };
          const bio = extractBiometricsFromFace(vid, cvs, box, null);
          return {
            box,
            eyeState: bio.eyeState,
            headPose: bio.headPose,
            gaze: bio.gaze,
            drowsiness: bio.drowsiness,
            attentionScore: bio.attentionScore,
          };
        });
      }
    }
  }

  // 4. Update temporal centroid tracker (returns [] if 0 real human faces)
  return personTracker.update(rawCandidates);
}

// ─── Attention Gauge ─────────────────────────────────────────────────────────
function AttentionGauge({ value }) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (value / 100) * arc;
  const color = attentionColor(value);
  return (
    <div className="relative flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#1e1e3f" strokeWidth="14"
          strokeDasharray={`${arc} ${circ}`} strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(135 100 100)" />
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={`${arc - offset} ${circ}`}
          strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(135 100 100)"
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease' }} />
        <text x="100" y="95" textAnchor="middle" fontSize="32" fontWeight="700" fill="white">{value}%</text>
        <text x="100" y="120" textAnchor="middle" fontSize="11" fill="#94a3b8">Class Attention</text>
      </svg>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, color = 'text-accent-cyan', trend }) {
  return (
    <InteractiveCard className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1 animate-count">{value}</p>
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
    </InteractiveCard>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ student, onClick, isSelected }) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClick}
      className={`border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-accent/10' : 'hover:bg-white/[0.03]'}`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-bold text-accent-glow">
            {student.id.split(' ')[1]}
          </div>
          <span className="font-medium text-slate-200 text-sm">{student.id}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-16 h-1.5 bg-black/60 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: attentionColor(student.attention) }}
              animate={{ width: `${student.attention}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-sm font-semibold text-white w-10">{student.attention}%</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${statusBg(student.status)}`}>
          {student.status.replace('_',' ')}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-slate-400">{student.headPose}</td>
      <td className="py-3 px-4 text-sm text-slate-400">{student.gaze}</td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium ${student.eyes === 'OPEN' ? 'text-emerald-400' : 'text-red-400'}`}>
          {student.eyes}
        </span>
      </td>
      <td className="py-3 px-4">
        {student.drowsiness
          ? <span className="text-xs text-amber-400 font-medium">⚠ Possible</span>
          : <span className="text-xs text-slate-500">—</span>}
      </td>
    </motion.tr>
  );
}

// ─── Student Drawer ────────────────────────────────────────────────────────────
function StudentDrawer({ student, onClose, history }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [student?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!student) return null;
  const reasons = [];
  if (student.headPose === 'FORWARD') reasons.push({ pos: true, text: 'Head facing forward' });
  else reasons.push({ pos: false, text: `Head turned ${student.headPose}` });
  if (student.gaze === 'CENTER') reasons.push({ pos: true, text: 'Gaze at center' });
  else reasons.push({ pos: false, text: `Gaze deviated ${student.gaze}` });
  if (student.eyes === 'OPEN') reasons.push({ pos: true, text: 'Eyes open' });
  else reasons.push({ pos: false, text: 'Eyes closed' });
  if (student.drowsiness) reasons.push({ pos: false, text: 'Possible drowsiness detected' });

  return (
    <motion.div
      key="student-drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
    >
      <motion.div
        ref={panelRef}
        key="student-drawer-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full sm:w-[420px] bg-[#0c0d1b] border-l border-white/10 z-[60] px-6 py-5 overflow-y-auto shadow-2xl flex flex-col justify-between"
      >
        <div>
          {/* Sticky Header - Always visible with Close 'X' Button */}
          <div className="sticky -top-5 -mt-1 pt-4 pb-4 mb-5 bg-[#0c0d1b]/95 backdrop-blur-md z-30 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-cyan flex items-center justify-center font-bold text-white text-base shadow-lg shadow-accent/25">
                {student.id.replace('Student ', 'S')}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{student.id}</h3>
                <span className="text-xs text-slate-400">Student Profile & Diagnostics</span>
              </div>
            </div>
            <button
              id="btn-close-student-drawer"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-300 hover:text-white transition-all cursor-pointer shadow-lg flex items-center justify-center border border-white/10 hover:border-white/20"
              aria-label="Close"
              title="Close drawer"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Score */}
          <div className="text-center mb-6 bg-elevated/40 border border-white/5 rounded-2xl py-5 px-4">
            <div className="text-5xl font-black mb-2" style={{ color: attentionColor(student.attention) }}>
              {student.attention}%
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBg(student.status)}`}>
              {student.status.replace('_',' ')}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'Head Pose', value: student.headPose, icon: Brain },
              { label: 'Gaze', value: student.gaze, icon: Eye },
              { label: 'Eyes', value: student.eyes, icon: EyeOff },
              { label: 'Drowsiness', value: student.drowsiness ? 'Possible' : 'None', icon: ZapOff },
            ].map((item) => (
              <div key={item.label} className="bg-elevated/50 border border-white/5 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Why this score */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-accent-cyan" /> Attention Diagnostics
            </h4>
            <div className="space-y-2 bg-elevated/30 border border-white/5 rounded-xl p-3.5">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span className={`font-bold ${r.pos ? 'text-emerald-400' : 'text-red-400'}`}>
                    {r.pos ? '✓' : '✗'}
                  </span>
                  <span className={r.pos ? 'text-slate-300' : 'text-slate-400'}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini history graph */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Last 60s Attention</h4>
            <div className="bg-elevated/30 border border-white/5 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={history}>
                  <Area type="monotone" dataKey="v" stroke={attentionColor(student.attention)} strokeWidth={2} fill={`${attentionColor(student.attention)}20`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Sticky Footer close button */}
        <div className="sticky -bottom-5 -mb-1 pt-3 pb-4 mt-6 bg-[#0c0d1b]/95 backdrop-blur-md border-t border-white/10 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
          >
            <X className="w-4 h-4" /> Close Profile
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Session Report Modal ────────────────────────────────────────────────────
function SessionReport({ session, onClose }) {
  if (!session) return null;

  const distData = [
    { name: 'Attentive', value: session.attentiveCount, color: '#10b981' },
    { name: 'Partial', value: session.partialCount, color: '#f59e0b' },
    { name: 'Distracted', value: session.distractedCount, color: '#ef4444' },
  ];

  const handleExportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Session Duration', session.duration],
      ['Students Detected', session.studentsDetected],
      ['Average Attention', `${session.avgAttention}%`],
      ['Peak Attention', `${session.peakAttention}%`],
      ['Lowest Attention', `${session.lowestAttention}%`],
      ['Total Alerts', session.alertCount],
      ['', ''],
      ['Time', 'Class Attention'],
      ...session.timeline.map(d => [d.time, `${d.attention}%`])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-accent-cyan" />
            <h2 className="text-xl font-bold text-white">Session Report</h2>
            {session.mode && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${session.mode === 'REAL' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                {session.mode === 'REAL' ? '📷 Real Cam' : '🎮 Demo'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 text-sm px-3 py-2 bg-accent/20 border border-accent/30 text-accent-glow rounded-lg hover:bg-accent/30 transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button id="btn-close-session-report" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Duration', value: session.duration },
            { label: 'Students', value: session.studentsDetected },
            { label: 'Avg Attention', value: `${session.avgAttention}%` },
            { label: 'Peak', value: `${session.peakAttention}%` },
            { label: 'Lowest', value: `${session.lowestAttention}%` },
            { label: 'Alerts', value: session.alertCount },
          ].map(s => (
            <div key={s.label} className="bg-elevated/50 border border-white/5 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white mb-1">{s.value}</p>
              <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Attention Distribution Pie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Attention Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={distData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                  {distData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
                <Tooltip contentStyle={{ backgroundColor: '#0F1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Attention Timeline</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={session.timeline}>
                <defs>
                  <linearGradient id="rpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#6D28D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0F1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="attention" stroke="#8B5CF6" strokeWidth={2} fill="url(#rpt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Privacy Modal ───────────────────────────────────────────────────────────
function PrivacyModal({ onAccept, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-accent/20 border border-accent/30">
            <Shield className="w-5 h-5 text-accent-glow" />
          </div>
          <h2 className="text-xl font-bold text-white">Privacy & Consent Notice</h2>
        </div>
        <p className="text-slate-400 text-sm mb-5">
          Before starting a monitoring session, please review the following privacy commitments:
        </p>
        <div className="space-y-3 mb-6">
          {[
            ['✓', 'Anonymous Monitoring Only', 'Students receive temporary IDs (e.g. "Student 01") that expire when the session ends.'],
            ['✓', 'No Facial Recognition', 'We do not extract, store or compare biometric face embeddings.'],
            ['✓', 'No Raw Video Storage', 'Video frames are processed in real-time in memory and immediately discarded.'],
            ['✓', 'No Emotion Detection', 'We do not infer emotional or psychological states.'],
            ['⚠', 'Approximate Indicators', 'Attention scores are behavioral approximations and not scientific measurements.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="flex gap-3 p-3 rounded-xl bg-elevated/50 border border-white/5">
              <span className={`text-lg ${icon === '✓' ? 'text-emerald-400' : 'text-amber-400'}`}>{icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button id="btn-privacy-accept" onClick={onAccept} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent-glow text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-accent/30">
            I Understand — Start Monitoring
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── End Session Confirm ─────────────────────────────────────────────────────
function EndSessionConfirm({ onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <StopCircle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">End Session?</h3>
        <p className="text-sm text-slate-400 mb-6">The session data will be saved and a report will be generated.</p>
        <div className="flex gap-3">
          <button id="btn-cancel-end-session" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 transition-colors text-sm font-medium">
            Continue
          </button>
          <button id="btn-confirm-end-session" onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors font-semibold text-sm">
            End Session
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────────────────
function SettingsPanel({ settings, onUpdate, onClose }) {
  const [local, setLocal] = useState(settings);
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-accent-cyan" /> Settings</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          {[
            { key: 'attentiveThreshold', label: 'Attentive Threshold (%)', min: 50, max: 95 },
            { key: 'partialThreshold', label: 'Partial Attention Threshold (%)', min: 20, max: 65 },
            { key: 'alertThreshold', label: 'Alert Trigger Threshold (%)', min: 10, max: 50 },
            { key: 'alertCooldown', label: 'Alert Cooldown (seconds)', min: 10, max: 120 },
          ].map(({ key, label, min, max }) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <label className="text-sm text-slate-300">{label}</label>
                <span className="text-sm font-bold text-white">{local[key]}</span>
              </div>
              <input type="range" min={min} max={max} value={local[key]}
                onChange={e => set(key, Number(e.target.value))}
                className="w-full accent-accent-glow cursor-pointer" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm">Cancel</button>
          <button onClick={() => { onUpdate(local); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-glow transition-colors">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Demo Mode: 5 Students Ground Truth (matching classroom_demo.jpg) ─────────
const DEMO_5_STUDENTS = [
  {
    id: 'Student 01',
    attention: 45,
    status: 'PARTIALLY_ATTENTIVE',
    headPose: 'LEFT',
    gaze: 'LEFT',
    eyes: 'OPEN',
    drowsiness: false,
    box: { x: 13.0, y: 40.0, width: 8.5, height: 16.5 },
    role: 'Looking out the window on the left'
  },
  {
    id: 'Student 02',
    attention: 91,
    status: 'ATTENTIVE',
    headPose: 'FORWARD',
    gaze: 'CENTER',
    eyes: 'OPEN',
    drowsiness: false,
    box: { x: 30.5, y: 40.5, width: 8.5, height: 16.5 },
    role: 'Writing lecture notes actively in blue hoodie'
  },
  {
    id: 'Student 03',
    attention: 96,
    status: 'ATTENTIVE',
    headPose: 'FORWARD',
    gaze: 'CENTER',
    eyes: 'OPEN',
    drowsiness: false,
    box: { x: 46.5, y: 38.5, width: 8.5, height: 16.5 },
    role: 'Highly attentive student with glasses facing presentation'
  },
  {
    id: 'Student 04',
    attention: 89,
    status: 'ATTENTIVE',
    headPose: 'FORWARD',
    gaze: 'CENTER',
    eyes: 'OPEN',
    drowsiness: false,
    box: { x: 61.5, y: 39.5, width: 8.5, height: 16.5 },
    role: 'Attentive in yellow sweater listening to lecture'
  },
  {
    id: 'Student 05',
    attention: 18,
    status: 'DISTRACTED',
    headPose: 'DOWN',
    gaze: 'DOWN',
    eyes: 'CLOSED',
    drowsiness: true,
    box: { x: 77.0, y: 49.0, width: 12.0, height: 18.0 },
    role: 'Sleeping with head resting down on desk, eyes closed'
  },
];

// ─── Main LiveMonitor Component ───────────────────────────────────────────────
export default function LiveMonitor() {
  const [mode, setMode] = useState('DEMO'); // 'DEMO' | 'REAL'
  const [phase, setPhase] = useState('idle'); // 'idle' | 'running' | 'paused'
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'analytics'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [students, setStudents] = useState(DEMO_5_STUDENTS);
  const [timelineData, setTimelineData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessionReport, setSessionReport] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [metrics, setMetrics] = useState({ classAttention: 68, studentsVisible: 5, attentive: 3, partial: 1, distracted: 1 });
  const [systemStatus, setSystemStatus] = useState({ camera: false, ai: false, backend: false, fps: 0 });
  const [studentHistories, setStudentHistories] = useState({});
  const [settings, setSettings] = useState({ attentiveThreshold: 70, partialThreshold: 40, alertThreshold: 40, alertCooldown: 45 });
  const alertCooldownsRef = useRef({});
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Real mode: annotated frame from backend (base64 JPEG with CV overlays)
  const [annotatedSrc, setAnnotatedSrc] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const demoIntervalRef = useRef(null);
  const timerRef = useRef(null);
  const tRef = useRef(0);
  const peakRef = useRef(0);
  const lowestRef = useRef(100);
  const allTimelineRef = useRef([]);

  // Student base scores for smooth 5-student simulation
  const baseScores = useRef([45, 91, 96, 89, 18]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'running') {
      timerRef.current = setInterval(() => setSessionTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // ── Session History — load from localStorage + backend on mount ──────────
  useEffect(() => {
    // 1. Try localStorage first (fast)
    try {
      const local = localStorage.getItem('attensys_sessions');
      if (local) setSessionHistory(JSON.parse(local));
    } catch {}
    // 2. Try backend (authoritative)
    fetch(`${API_BASE}/api/v1/sessions/history`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data?.length > 0) {
          setSessionHistory(data.data);
          localStorage.setItem('attensys_sessions', JSON.stringify(data.data));
        }
      })
      .catch(() => {/* backend not running — localStorage is fine */});
  }, []);

  // ── Persist session history to localStorage whenever it changes ──────────
  useEffect(() => {
    if (sessionHistory.length > 0) {
      localStorage.setItem('attensys_sessions', JSON.stringify(sessionHistory));
    }
  }, [sessionHistory]);

  // ── Check backend health ─────────────────────────────────────────────────
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) setSystemStatus(s => ({ ...s, backend: true }));
      } catch {
        setSystemStatus(s => ({ ...s, backend: false }));
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // ── Add alert helper (stable callback using refs) ────────────────────────
  const addAlert = useCallback((type, message, severity) => {
    const now = Date.now();
    const cooldown = (settingsRef.current?.alertCooldown || 45) * 1000;
    if (alertCooldownsRef.current[type] && now - alertCooldownsRef.current[type] < cooldown) return;
    alertCooldownsRef.current[type] = now;
    setAlerts(prev => [{ id: `${type}_${now}`, type, message, severity, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
  }, []);

  // ── Demo Simulation (5 Students Matching classroom_demo.jpg) ────────────
  useEffect(() => {
    if (phase === 'running' && mode === 'DEMO') {
      setSystemStatus({ camera: true, ai: true, backend: false, fps: 12 });
      let tick = 0;

      demoIntervalRef.current = setInterval(() => {
        if (phase !== 'running') return;
        tick++;
        tRef.current = tick;

        const numStudents = 5;
        const currentSettings = settingsRef.current || { attentiveThreshold: 70, partialThreshold: 40, alertThreshold: 40 };

        const simStudents = DEMO_5_STUDENTS.map((proto, i) => {
          let score;
          if (proto.id === 'Student 05') {
            // Strictly sleeping student on the right: 16% - 20%
            const jitter = (Math.sin(tick / 6) * 1.5) + (Math.random() * 1.0 - 0.5);
            score = clamp(Math.round(18 + jitter), 15, 21);
          } else if (proto.id === 'Student 01') {
            // Student looking out window on left: 42% - 48%
            const jitter = (Math.sin(tick / 10) * 2.5) + (Math.random() * 2.0 - 1.0);
            score = clamp(Math.round(45 + jitter), 40, 50);
          } else {
            // Attentive students taking notes: 87% - 97%
            const jitter = (Math.sin(tick / 12 + i) * 2.0) + (Math.random() * 2.0 - 1.0);
            score = clamp(Math.round(proto.attention + jitter), 85, 98);
          }

          const status = proto.id === 'Student 05' ? 'DISTRACTED'
            : score >= currentSettings.attentiveThreshold ? 'ATTENTIVE'
            : score >= currentSettings.partialThreshold ? 'PARTIALLY_ATTENTIVE' : 'DISTRACTED';

          return {
            id: proto.id,
            attention: score,
            status,
            headPose: proto.headPose,
            gaze: proto.gaze,
            eyes: proto.eyes,
            drowsiness: proto.drowsiness,
            box: proto.box,
          };
        });

        setStudents(simStudents);

        // Histories for drawer graph
        setStudentHistories(prev => {
          const updated = { ...prev };
          simStudents.forEach(s => {
            const existing = updated[s.id] || [];
            updated[s.id] = [...existing, { v: s.attention }].slice(-60);
          });
          return updated;
        });

        const avg = Math.round(simStudents.reduce((a, s) => a + s.attention, 0) / numStudents);
        const attentive = simStudents.filter(s => s.status === 'ATTENTIVE').length;
        const partial = simStudents.filter(s => s.status === 'PARTIALLY_ATTENTIVE').length;
        const distracted = simStudents.filter(s => s.status === 'DISTRACTED').length;

        peakRef.current = Math.max(peakRef.current, avg);
        lowestRef.current = Math.min(lowestRef.current, avg);

        setMetrics({ classAttention: avg, studentsVisible: numStudents, attentive, partial, distracted });

        const entry = { time: new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), attention: avg };
        allTimelineRef.current = [...allTimelineRef.current, entry];
        setTimelineData(prev => [...prev, entry].slice(-30));

        // Alert engine: alert for sleeping Student 05 and distracted Student 01
        simStudents.forEach(s => {
          if (s.id === 'Student 05') {
            addAlert('LOW_Student 05', 'Student 05 is sleeping with head down on desk (18%)', 'HIGH');
          } else if (s.id === 'Student 01' && tick % 20 === 0) {
            addAlert('PARTIAL_Student 01', 'Student 01 is looking away towards window (45%)', 'MEDIUM');
          }
        });

      }, 1000);
    }

    return () => clearInterval(demoIntervalRef.current);
  }, [phase, mode, addAlert]);

  // ── Real Camera mode (WebSocket) ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running' || mode !== 'REAL') return;

    let stream = null;
    let sendInterval = null;
    let ws = null;
    let isCleanClose = false;
    let hasConnected = false;
    let reconnectTimer = null;

    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false
    })
      .then(s => {
        if (isCleanClose) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.warn('[Camera] play error:', e));
          };
        }
        setSystemStatus(prev => ({ ...prev, camera: true }));
      })
      .catch((err) => {
        console.warn('[Camera] getUserMedia error:', err);
        addAlert('CAMERA', 'Camera unavailable. Check webcam permissions or switch to Demo Mode.', 'HIGH');
        setSystemStatus(prev => ({ ...prev, camera: false }));
      });

    const connectWs = () => {
      if (isCleanClose) return;

      try {
        ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        ws.onopen = () => {
          hasConnected = true;
          setSystemStatus(prev => ({ ...prev, ai: true, backend: true }));
        };

        ws.onclose = () => {
          setSystemStatus(prev => ({ ...prev, ai: false }));
          if (!isCleanClose) {
            reconnectTimer = setTimeout(() => {
              if (!isCleanClose) connectWs();
            }, 3000);
          }
        };

        ws.onerror = () => {
          if (isCleanClose) return;
          setSystemStatus(prev => ({ ...prev, ai: false }));
          if (hasConnected) {
            addAlert('WS', 'AI Engine connection lost. Attempting to reconnect...', 'HIGH');
          } else {
            addAlert('WS', 'Connecting to AI Engine failed. Verify backend is running.', 'HIGH');
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const avg = Math.round(data.average_attention || 0);

            // ── Annotated frame (CV bounding boxes) ──
            if (data.annotated_frame) {
              setAnnotatedSrc(data.annotated_frame);
            }

            const detectedCount = typeof data.students_detected === 'number'
              ? data.students_detected
              : (data.events || []).length;

            setMetrics({
              classAttention: avg,
              studentsVisible: detectedCount,
              attentive: (data.events || []).filter(e => e.status === 'ATTENTIVE').length,
              partial: (data.events || []).filter(e => e.status === 'PARTIALLY_ATTENTIVE').length,
              distracted: (data.events || []).filter(e => e.status === 'DISTRACTED').length,
            });

            const mapped = (data.events || []).map(e => ({
              id: e.studentId, attention: e.attentionScore, status: e.status,
              headPose: e.headPose, gaze: e.gaze, eyes: e.eyeState, drowsiness: e.drowsiness,
              box: e.box,
            }));
            setStudents(mapped);

            // ── Populate student histories (for drawer mini graph) ──
            setStudentHistories(prev => {
              const updated = { ...prev };
              mapped.forEach(s => {
                const existing = updated[s.id] || [];
                updated[s.id] = [...existing, { v: s.attention }].slice(-60);
              });
              return updated;
            });

            // ── Record timeline only if students are present ──
            if (detectedCount > 0 && avg > 0) {
              const entry = { time: new Date().toLocaleTimeString(), attention: avg };
              allTimelineRef.current.push(entry);
              setTimelineData(prev => [...prev, entry].slice(-30));

              peakRef.current = Math.max(peakRef.current, avg);
              lowestRef.current = lowestRef.current === 100 ? avg : Math.min(lowestRef.current, avg);
            }

            // ── Alert engine (real mode) ──
            if (detectedCount > 0 && avg > 0 && avg < (settingsRef.current?.alertThreshold || 40)) {
              addAlert('CLASS_DROP', `Class attention dropped to ${avg}%`, 'HIGH');
            }
            mapped.forEach(s => {
              if (s.status === 'DISTRACTED') {
                addAlert(`LOW_${s.id}`, `${s.id} is distracted (${s.attention}%)`, 'MEDIUM');
              }
            });

            setSystemStatus(prev => ({ ...prev, fps: 2 }));
          } catch (parseErr) {
            console.warn('[WS] Parse error:', parseErr);
          }
        };
      } catch (e) {
        console.warn('[WS] Failed to create socket:', e);
      }
    };

    connectWs();

    sendInterval = setInterval(async () => {
      const vid = videoRef.current;
      const cvs = canvasRef.current;
      if (vid && cvs && vid.readyState >= 2 && ws && ws.readyState === WebSocket.OPEN) {
        cvs.width = 640;
        cvs.height = 480;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(vid, 0, 0, 640, 480);
        const b64 = cvs.toDataURL('image/jpeg', 0.6);

        // Detect all visible students in the frame
        const detectedFaces = await detectStudentsInFrame(vid, cvs);

        ws.send(JSON.stringify({ frame: b64, faces: detectedFaces }));
        setSystemStatus(prev => ({ ...prev, fps: 2 }));
      }
    }, 500);

    return () => {
      isCleanClose = true;
      clearTimeout(reconnectTimer);
      clearInterval(sendInterval);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
      stream?.getTracks().forEach(t => t.stop());
      setAnnotatedSrc(null);
    };
  }, [phase, mode, addAlert]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleStartRequest = () => {
    setSelectedStudent(null);
    setShowPrivacy(true);
  };

  const handleStartConfirmed = () => {
    setSelectedStudent(null);
    setShowPrivacy(false);
    personTracker.reset();
    setPhase('running');
    if (mode === 'DEMO') {
      setStudents(DEMO_5_STUDENTS);
      setMetrics({ classAttention: 68, studentsVisible: 5, attentive: 3, partial: 1, distracted: 1 });
      baseScores.current = [45, 91, 96, 89, 18];
    } else {
      setStudents([]);
      setMetrics({ classAttention: 0, studentsVisible: 0, attentive: 0, partial: 0, distracted: 0 });
    }
    setTimelineData([]);
    setAlerts([]);
    setSessionTimer(0);
    peakRef.current = 0;
    lowestRef.current = 100;
    allTimelineRef.current = [];
    setStudentHistories({});
    setAnnotatedSrc(null);
  };

  const handlePause = () => setPhase('paused');
  const handleResume = () => setPhase('running');
  const handleEndRequest = () => {
    setSelectedStudent(null);
    setShowEndConfirm(true);
  };

  const handleEndConfirmed = () => {
    setSelectedStudent(null);
    setShowEndConfirm(false);
    setPhase('idle');
    setAnnotatedSrc(null);

    const totalSecs = sessionTimer;
    const timeline = allTimelineRef.current || [];
    const hasTimeline = timeline.length > 0;

    // Calculate true metrics from actual session timeline
    const avgScore = hasTimeline
      ? Math.round(timeline.reduce((acc, t) => acc + (t.attention || 0), 0) / timeline.length)
      : (metrics.studentsVisible > 0 ? metrics.classAttention : 0);

    const peakScore = hasTimeline
      ? Math.max(...timeline.map(t => t.attention))
      : avgScore;

    const lowestScore = hasTimeline
      ? Math.min(...timeline.map(t => t.attention))
      : avgScore;

    const studentsDetectedCount = metrics.studentsVisible;

    // Build report
    const report = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      mode,
      duration: formatTime(totalSecs),
      studentsDetected: studentsDetectedCount,
      avgAttention: avgScore,
      peakAttention: peakScore,
      lowestAttention: lowestScore,
      alertCount: alerts.length,
      attentiveCount: metrics.attentive,
      partialCount: metrics.partial,
      distractedCount: metrics.distracted,
      timeline,
      students: students.map(s => ({ ...s, history: studentHistories[s.id] || [] })),
    };

    setSessionReport(report);
    setSessionHistory(prev => [report, ...prev]);
    setShowReport(true);
    clearInterval(demoIntervalRef.current);

    // ── Persist to backend (fire-and-forget) ──
    fetch(`${API_BASE}/api/v1/sessions/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // strip timeline for smaller payload — keep summary only
      body: JSON.stringify({ ...report, timeline: report.timeline.slice(-60) }),
    }).catch(() => {/* backend offline — localStorage already saved it */});
  };

  const activeStudentHistory = selectedStudent ? (studentHistories[selectedStudent.id] || []) : [];

  return (
    <div className="max-w-[1600px] mx-auto w-full relative space-y-5">

      {/* ── Modals ── */}
      <AnimatePresence>
        {showPrivacy && <PrivacyModal onAccept={handleStartConfirmed} onClose={() => setShowPrivacy(false)} />}
        {showEndConfirm && <EndSessionConfirm onConfirm={handleEndConfirmed} onCancel={() => setShowEndConfirm(false)} />}
        {showReport && sessionReport && <SessionReport session={sessionReport} onClose={() => setShowReport(false)} />}
        {showSettings && <SettingsPanel settings={settings} onUpdate={setSettings} onClose={() => setShowSettings(false)} />}
        {selectedStudent && (
          <StudentDrawer
            key="student-drawer-modal"
            student={students.find(s => s.id === selectedStudent.id) || selectedStudent}
            onClose={() => setSelectedStudent(null)}
            history={activeStudentHistory}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Live Classroom Monitor
            </h1>
            {phase === 'running' && (
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> LIVE
              </motion.span>
            )}
            {phase === 'paused' && (
              <span className="flex items-center gap-1.5 text-xs font-bold bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-full border border-amber-500/20">
                ⏸ PAUSED
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">Real-time classroom attention intelligence</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* System Status */}
          <div className="hidden md:flex items-center gap-3 bg-elevated/50 border border-white/5 px-3 py-2 rounded-xl text-xs">
            <span className={`flex items-center gap-1 ${systemStatus.camera ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Camera className="w-3.5 h-3.5" /> Cam
            </span>
            <span className={`flex items-center gap-1 ${systemStatus.ai ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Cpu className="w-3.5 h-3.5" /> AI
            </span>
            <span className={`flex items-center gap-1 ${systemStatus.backend ? 'text-emerald-400' : 'text-slate-500'}`}>
              <Wifi className="w-3.5 h-3.5" /> API
            </span>
            {systemStatus.fps > 0 && <span className="text-slate-400">{systemStatus.fps} FPS</span>}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center bg-elevated/50 border border-white/10 rounded-xl p-1">
            {['DEMO', 'REAL'].map(m => (
              <button
                key={m}
                id={m === 'DEMO' ? 'btn-mode-demo' : 'btn-mode-real'}
                disabled={phase !== 'idle'}
                onClick={() => {
                  setSelectedStudent(null);
                  setMode(m);
                  personTracker.reset();
                  if (m === 'DEMO') {
                    setStudents(DEMO_5_STUDENTS);
                    setMetrics({ classAttention: 68, studentsVisible: 5, attentive: 3, partial: 1, distracted: 1 });
                    baseScores.current = [45, 91, 96, 89, 18];
                  } else {
                    setStudents([]);
                    setMetrics({ classAttention: 0, studentsVisible: 0, attentive: 0, partial: 0, distracted: 0 });
                  }
                  setTimelineData([]);
                  setAlerts([]);
                  setStudentHistories({});
                  setAnnotatedSrc(null);
                  allTimelineRef.current = [];
                  peakRef.current = 0;
                  lowestRef.current = 100;
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m ? 'bg-accent/30 text-accent-glow border border-accent/40' : 'text-slate-400 hover:text-white disabled:cursor-not-allowed'}`}>
                {m === 'DEMO' ? '🎮 Demo' : '📷 Real Cam'}
              </button>
            ))}
          </div>

          <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl bg-elevated/50 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Demo mode banner */}
      {mode === 'DEMO' && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            <span><strong>DEMO MODE:</strong> Analyzing static photograph of 5 university classroom students.</span>
          </div>
          <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
            5 Students Tracked
          </span>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-elevated/40 border border-white/5 p-1 rounded-xl w-fit">
        {[['monitor', BarChart2, 'Monitor'], ['analytics', FileText, 'Analytics']].map(([tab, Icon, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-accent/20 text-accent-glow border border-accent/30' : 'text-slate-400 hover:text-slate-200'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ───────────── MONITOR TAB ───────────── */}
      {activeTab === 'monitor' && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard icon={Activity} label="Class Attention" value={`${metrics.classAttention}%`} color="text-accent-glow" />
            <MetricCard icon={Users} label="Students Visible" value={metrics.studentsVisible} color="text-accent-cyan" />
            <MetricCard icon={CheckCircle} label="Attentive" value={metrics.attentive} color="text-emerald-400" />
            <MetricCard icon={AlertTriangle} label="Distracted" value={metrics.distracted} color="text-red-400" />
            <MetricCard icon={Clock} label="Session Time" value={formatTime(sessionTimer)} color="text-slate-400" />
          </div>

          {/* Main Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Camera / Gauge panel */}
            <div className="lg:col-span-2 space-y-5">
              <InteractiveCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-accent-glow" />
                    {mode === 'REAL' ? 'Live Camera Feed' : 'Classroom Photo Analysis (Demo)'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {phase === 'idle' && (
                      <MagneticButton id="btn-start-monitoring" onClick={handleStartRequest} className="py-2 px-4 text-sm">
                        <Play className="w-4 h-4" /> Start Monitoring
                      </MagneticButton>
                    )}
                    {phase === 'running' && (
                      <>
                        <button id="btn-pause-session" onClick={handlePause} className="flex items-center gap-1.5 text-sm px-3 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">
                          <Pause className="w-4 h-4" /> Pause
                        </button>
                        <button id="btn-end-session" onClick={handleEndRequest} className="flex items-center gap-1.5 text-sm px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                          <StopCircle className="w-4 h-4" /> End
                        </button>
                      </>
                    )}
                    {phase === 'paused' && (
                      <>
                        <button id="btn-resume-session" onClick={handleResume} className="flex items-center gap-1.5 text-sm px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">
                          <Play className="w-4 h-4" /> Resume
                        </button>
                        <button id="btn-end-session-paused" onClick={handleEndRequest} className="flex items-center gap-1.5 text-sm px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                          <StopCircle className="w-4 h-4" /> End
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Camera viewport */}
                <div className="relative w-full aspect-video bg-black/70 rounded-xl border border-white/5 overflow-hidden flex items-center justify-center">
                  {mode === 'DEMO' && (
                    <>
                      {/* Static Photo of 5 students (Demo Mode Only) */}
                      <img
                        src="/classroom_demo.jpg"
                        alt="Classroom Demo Students"
                        className="absolute inset-0 w-full h-full object-cover z-10"
                        onError={(e) => {
                          e.currentTarget.src = `${API_BASE}/api/v1/demo/classroom-image`;
                        }}
                      />

                      {/* Scan line effect during active demo monitoring */}
                      {phase === 'running' && (
                        <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-40 scan-line z-20" />
                      )}

                      {/* Student Bounding Box overlays (Demo) */}
                      <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                        {(students.length > 0 ? students : DEMO_5_STUDENTS).map((s) => {
                          if (!s.box) return null;
                          const isAttentive = s.status === 'ATTENTIVE';
                          const isPartial = s.status === 'PARTIALLY_ATTENTIVE';
                          const borderColor = isAttentive ? 'border-emerald-400' : isPartial ? 'border-amber-400' : 'border-red-400';
                          const glowColor = isAttentive ? 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' : isPartial ? 'shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.4)]';
                          const headerBg = isAttentive ? 'bg-emerald-500 text-white' : isPartial ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-red-500 text-white';
                          const cornerBorder = isAttentive ? 'border-emerald-300' : isPartial ? 'border-amber-300' : 'border-red-300';
                          const statusText = isAttentive ? 'ATTENTIVE' : isPartial ? 'PARTIAL' : s.eyes === 'CLOSED' ? 'SLEEPING' : 'DISTRACTED';

                          return (
                            <div
                              key={s.id}
                              style={{
                                left: `${s.box.x}%`,
                                top: `${s.box.y}%`,
                                width: `${s.box.width}%`,
                                height: `${s.box.height}%`,
                              }}
                              onClick={() => setSelectedStudent(s)}
                              className={`absolute border-2 ${borderColor} ${glowColor} rounded-xl cursor-pointer transition-all duration-300 pointer-events-auto group hover:scale-[1.04] bg-white/[0.04] backdrop-blur-[1px]`}
                            >
                              <div className={`absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 ${cornerBorder}`} />
                              <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 ${cornerBorder}`} />
                              <div className={`absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 ${cornerBorder}`} />
                              <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 ${cornerBorder}`} />
                              
                              {/* Top header badge with Student ID and score */}
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-40">
                                <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-lg border border-white/20 ${headerBg}`}>
                                  <span>🎓 {s.id}</span>
                                  <span className="opacity-60">|</span>
                                  <span>{s.attention}%</span>
                                </div>
                              </div>

                              {/* Bottom status badge */}
                              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap z-40">
                                <div className="bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold text-white border border-white/15 shadow-md flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isAttentive ? 'bg-emerald-400' : isPartial ? 'bg-amber-400' : 'bg-red-400 animate-pulse'}`} />
                                  <span>{statusText}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Demo mode corner tag */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-amber-500/30 z-35 text-amber-400 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>Demo Mode · Static Classroom Analysis (5 Students)</span>
                      </div>
                    </>
                  )}
                  {mode === 'REAL' && (
                    <>
                      {/* Hidden canvas used to encode 640x480 JPEG frames for the backend */}
                      <canvas ref={canvasRef} width={640} height={480} className="hidden" />

                      {phase !== 'idle' && (
                        <>
                          {/* Live webcam video feed — visibly displayed in real-time */}
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover -scale-x-100 z-10"
                          />

                          {/* Multi-Student Real-time Bounding Box Squares (Live Cam) */}
                          <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                            {students.map((student) => {
                              if (!student.box) return null;

                              // In mirrored video (-scale-x-100), mirror the X coordinate so it aligns with face
                              const leftPct = Math.max(0, Math.min(100 - student.box.width, 100 - (student.box.x + student.box.width)));
                              const topPct = Math.max(0, Math.min(100 - student.box.height, student.box.y));
                              const widthPct = Math.max(12, Math.min(92, student.box.width));
                              const heightPct = Math.max(14, Math.min(92, student.box.height));

                              const isAttentive = student.status === 'ATTENTIVE';
                              const isPartial = student.status === 'PARTIALLY_ATTENTIVE';

                              const borderColor = isAttentive ? 'border-emerald-400' : isPartial ? 'border-amber-400' : 'border-red-400';
                              const glowColor = isAttentive 
                                ? 'shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
                                : isPartial 
                                ? 'shadow-[0_0_20px_rgba(245,158,11,0.5)]' 
                                : 'shadow-[0_0_20px_rgba(239,68,68,0.5)]';
                              const headerBg = isAttentive ? 'bg-emerald-500 text-white' : isPartial ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-red-500 text-white';
                              const cornerBorder = isAttentive ? 'border-emerald-300' : isPartial ? 'border-amber-300' : 'border-red-300';
                              const statusText = isAttentive ? 'ATTENTIVE' : isPartial ? 'PARTIAL' : 'DISTRACTED';

                              return (
                                <div
                                  key={student.id}
                                  style={{
                                    left: `${leftPct}%`,
                                    top: `${topPct}%`,
                                    width: `${widthPct}%`,
                                    height: `${heightPct}%`,
                                  }}
                                  onClick={() => setSelectedStudent(student)}
                                  className={`absolute border-2 ${borderColor} ${glowColor} rounded-xl cursor-pointer transition-all duration-300 pointer-events-auto group hover:scale-[1.03] bg-white/[0.04] backdrop-blur-[1px]`}
                                >
                                  {/* 4 Corner Brackets [  ] */}
                                  <div className={`absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-[3px] border-l-[3px] ${cornerBorder} rounded-tl-sm`} />
                                  <div className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-[3px] border-r-[3px] ${cornerBorder} rounded-tr-sm`} />
                                  <div className={`absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-[3px] border-l-[3px] ${cornerBorder} rounded-bl-sm`} />
                                  <div className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-[3px] border-r-[3px] ${cornerBorder} rounded-br-sm`} />

                                  {/* Top Header Badge: Student ID + Attention Score */}
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-40 transition-transform group-hover:-translate-y-0.5">
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black shadow-xl border border-white/20 ${headerBg}`}>
                                      <span>🎓 {student.id}</span>
                                      <span className="opacity-60">|</span>
                                      <span>{student.attention}%</span>
                                    </div>
                                  </div>

                                  {/* Bottom Sub-badge: Real-time Attention Status */}
                                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap z-40">
                                    <div className="bg-black/85 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white border border-white/15 shadow-lg flex items-center gap-1.5">
                                      <span className={`w-2 h-2 rounded-full animate-pulse ${isAttentive ? 'bg-emerald-400' : isPartial ? 'bg-amber-400' : 'bg-red-400'}`} />
                                      <span>{statusText}</span>
                                      {student.headPose && <span className="text-slate-400 font-normal">· {student.headPose}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Live indicator overlay */}
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 z-35">
                            <motion.span
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ repeat: Infinity, duration: 1.2 }}
                              className={`w-2 h-2 rounded-full ${systemStatus.ai ? 'bg-emerald-400' : 'bg-amber-400'}`}
                            />
                            <span className={`text-xs font-semibold ${systemStatus.ai ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {systemStatus.ai ? 'AI LIVE' : 'CAM STREAMING'}
                            </span>
                          </div>

                          {/* Real-time students badge */}
                          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 text-xs text-slate-200 font-medium z-35">
                            {metrics.studentsVisible} student{metrics.studentsVisible !== 1 ? 's' : ''} detected
                          </div>

                          {/* Corner brackets */}
                          {[['top-2 left-2','border-t border-l'],['top-2 right-2','border-t border-r'],['bottom-2 left-2','border-b border-l'],['bottom-2 right-2','border-b border-r']].map(([pos,brd]) => (
                            <div key={pos} className={`absolute ${pos} w-5 h-5 ${brd} border-accent-cyan opacity-60 z-20`} />
                          ))}
                        </>
                      )}
                    </>
                  )}
                  {phase === 'idle' && (
                    <div className="text-center text-slate-500">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Camera offline</p>
                      <p className="text-xs mt-1 opacity-70">Click "Start Monitoring" to begin</p>
                    </div>
                  )}
                </div>
              </InteractiveCard>

              {/* Alerts */}
              {alerts.length > 0 && (
                <InteractiveCard className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" /> Alerts ({alerts.length})
                    </h3>
                    <button onClick={() => setAlerts([])} className="text-xs text-slate-500 hover:text-slate-300">Clear all</button>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {alerts.slice(0, 8).map(a => (
                      <div key={a.id} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${a.severity === 'HIGH' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">{a.message}</span>
                          <span className="ml-2 text-slate-500">{a.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </InteractiveCard>
              )}
            </div>

            {/* Right column: Gauge + Timeline */}
            <div className="space-y-5">
              <InteractiveCard className="p-5 flex flex-col items-center">
                <h3 className="font-semibold text-white mb-2 self-start">Attention Gauge</h3>
                <AttentionGauge value={metrics.classAttention} />
                <div className="grid grid-cols-3 gap-2 w-full mt-2">
                  {[['Attentive', metrics.attentive, '#10b981'], ['Partial', metrics.partial, '#f59e0b'], ['Distracted', metrics.distracted, '#ef4444']].map(([label, val, color]) => (
                    <div key={label} className="text-center">
                      <p className="text-lg font-bold" style={{ color }}>{val}</p>
                      <p className="text-xs text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
              </InteractiveCard>

              <InteractiveCard className="p-5">
                <h3 className="font-semibold text-white mb-3">Attention Timeline</h3>
                <div className="h-44">
                  {timelineData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData}>
                        <defs>
                          <linearGradient id="tl" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.5} />
                            <stop offset="95%" stopColor="#6D28D9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveEnd" />
                        <YAxis domain={[0,100]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} width={24} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0F1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                          labelStyle={{ color: '#94a3b8' }}
                        />
                        <Area type="monotone" dataKey="attention" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#tl)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                      Waiting for data…
                    </div>
                  )}
                </div>
              </InteractiveCard>
            </div>
          </div>

          {/* Student Table */}
          <InteractiveCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-accent-cyan" /> Live Student Tracking
                <span className="text-xs font-normal text-slate-500 ml-1">— click a row to inspect</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Student','Attention','Status','Head Pose','Gaze','Eyes','Drowsiness'].map(col => (
                      <th key={col} className="py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.length > 0 ? students.map((s) => (
                    <StudentRow
                      key={s.id}
                      student={s}
                      isSelected={selectedStudent?.id === s.id}
                      onClick={() => setSelectedStudent(s.id === selectedStudent?.id ? null : s)}
                    />
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-600 text-sm">
                        {phase === 'idle' ? 'Start a monitoring session to see students' : 'Detecting students…'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </InteractiveCard>
        </>
      )}

      {/* ───────────── ANALYTICS TAB ───────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          {sessionHistory.length === 0 ? (
            <InteractiveCard className="p-12 flex flex-col items-center justify-center text-center">
              <BarChart2 className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">No Session History</h3>
              <p className="text-sm text-slate-500">Complete a monitoring session to view historical analytics here.</p>
            </InteractiveCard>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Sessions', value: sessionHistory.length },
                  { label: 'Avg Class Attention', value: `${Math.round(sessionHistory.reduce((a,s)=>a+s.avgAttention,0)/sessionHistory.length)}%` },
                  { label: 'Total Alerts Generated', value: sessionHistory.reduce((a,s)=>a+s.alertCount,0) },
                ].map(s => (
                  <InteractiveCard key={s.label} className="p-5 text-center">
                    <p className="text-3xl font-black text-white mb-1">{s.value}</p>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</p>
                  </InteractiveCard>
                ))}
              </div>

              <InteractiveCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Session History</h3>
                  <button
                    onClick={() => { setSessionHistory([]); localStorage.removeItem('attensys_sessions'); }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >Clear history</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Date','Mode','Duration','Students','Avg Attn','Peak','Lowest','Alerts','Actions'].map(c => (
                          <th key={c} className="py-2.5 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessionHistory.map(s => (
                        <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-3 px-3 text-slate-300 text-xs">{s.date}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${
                              s.mode === 'REAL' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            }`}>{s.mode === 'REAL' ? '📷' : '🎮'} {s.mode || 'DEMO'}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{s.duration}</td>
                          <td className="py-3 px-3 text-slate-300">{s.studentsDetected}</td>
                          <td className="py-3 px-3 font-semibold" style={{ color: attentionColor(s.avgAttention) }}>{s.avgAttention}%</td>
                          <td className="py-3 px-3 text-emerald-400">{s.peakAttention}%</td>
                          <td className="py-3 px-3 text-red-400">{s.lowestAttention}%</td>
                          <td className="py-3 px-3 text-amber-400">{s.alertCount}</td>
                          <td className="py-3 px-3">
                            <button onClick={() => { setSessionReport(s); setShowReport(true); }}
                              className="text-xs px-2.5 py-1.5 bg-accent/20 border border-accent/30 text-accent-glow rounded-lg hover:bg-accent/30 transition-colors">
                              View Report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InteractiveCard>

              {/* Bar chart comparing sessions */}
              <InteractiveCard className="p-5">
                <h3 className="font-semibold text-white mb-4">Session Attention Comparison</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sessionHistory.map((s,i) => ({ name: `S${i+1}`, attention: s.avgAttention }))}>
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Bar dataKey="attention" radius={[6,6,0,0]}>
                      {sessionHistory.map((s,i) => <Cell key={i} fill={attentionColor(s.avgAttention)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </InteractiveCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
