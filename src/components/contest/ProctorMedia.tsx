"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { MediaProctoringConfig } from "@/components/contest/SystemCheck";

interface ProctorMediaProps {
  contestId: string;
  config: MediaProctoringConfig;
  cameraStream: MediaStream | null;
  screenStream: MediaStream | null;
  children: ReactNode;
}

// Model weights are loaded once from the MediaPipe CDN (jsDelivr).
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// Snapshot cadence — baseline is slow; tightens after a flag (mirrors HackerRank).
const BASELINE_SNAPSHOT_MS = 15000;
const HEIGHTENED_SNAPSHOT_MS = 5000;
const HEIGHTENED_WINDOW_MS = 30000;

// Detection cadence + how long a condition must hold before it's a flag.
const DETECT_INTERVAL_MS = 1000;
const NO_FACE_HOLD_MS = 4000;
const MULTI_FACE_HOLD_MS = 2000;
const CAMERA_LOST_HOLD_MS = 5000;

/**
 * ProctorMedia — on-device camera/screen proctoring.
 *
 * Runs entirely in the candidate's browser: MediaPipe face detection for
 * presence / multiple-face, adaptive webcam snapshots as evidence, and a
 * camera-loss heartbeat. Flags are POSTed to /api/proctor/[id]/flag; the
 * server owns the risk score and termination policy. Renders children
 * transparently (no visible self-view — the video element is off-screen).
 */
export default function ProctorMedia({
  contestId,
  config,
  cameraStream,
  screenStream,
  children,
}: ProctorMediaProps) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Mutable timing state kept in refs so the effect runs once.
  const heightenedUntilRef = useRef(0);
  const lastSnapshotRef = useRef(0);
  const noFaceSinceRef = useRef<number | null>(null);
  const multiFaceSinceRef = useRef<number | null>(null);
  const cameraLostSinceRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  // Send a flag; escalate snapshot cadence for a while afterwards.
  const sendFlag = async (
    type: string,
    opts: { details?: string; confidence?: number; evidenceKey?: string; durationMs?: number } = {}
  ) => {
    heightenedUntilRef.current = Date.now() + HEIGHTENED_WINDOW_MS;
    try {
      await fetch(`/api/proctor/${contestId}/flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, ...opts }),
      });
    } catch {
      /* best-effort; server heartbeat/snapshots still record presence */
    }
  };

  // Capture a JPEG from a video element and upload it; returns the evidence key.
  const captureSnapshot = async (
    video: HTMLVideoElement | null,
    kind: "webcam" | "screen"
  ): Promise<string | null> => {
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.6)
    );
    if (!blob) return null;

    try {
      const form = new FormData();
      form.append("snapshot", blob, `${kind}.jpg`);
      form.append("kind", kind);
      const res = await fetch(`/api/proctor/${contestId}/snapshot`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      return data.evidenceKey || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!config.enabled) return;
    stoppedRef.current = false;

    // Attach streams to off-screen video elements
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.style.display = "none";
    videoRef.current = video;
    if (cameraStream) {
      video.srcObject = cameraStream;
      video.play().catch(() => {});
    }
    document.body.appendChild(video);

    let screenVideo: HTMLVideoElement | null = null;
    if (config.requireScreen && screenStream) {
      screenVideo = document.createElement("video");
      screenVideo.muted = true;
      screenVideo.playsInline = true;
      screenVideo.style.display = "none";
      screenVideo.srcObject = screenStream;
      screenVideo.play().catch(() => {});
      screenVideoRef.current = screenVideo;
      document.body.appendChild(screenVideo);

      // Flag when the candidate stops sharing their screen
      const track = screenStream.getVideoTracks()[0];
      track?.addEventListener("ended", () => {
        sendFlag("SCREEN_SHARE_STOPPED", { details: "Candidate stopped screen sharing" });
      });
    }

    let faceDetector: any = null;
    let detectTimer: ReturnType<typeof setInterval> | null = null;
    let snapshotTimer: ReturnType<typeof setInterval> | null = null;

    // ── Load the face detector (best-effort; degrade gracefully) ──
    const initFaceDetection = async () => {
      if (!config.requireCamera) return;
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        faceDetector = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
        });
      } catch (err) {
        console.warn("Face detection unavailable (model load failed):", err);
      }
    };

    // ── Detection loop (face presence / multiple faces / camera loss) ──
    const runDetection = () => {
      if (stoppedRef.current) return;
      const now = Date.now();

      // Camera-loss check first
      const track = cameraStream?.getVideoTracks()[0];
      const cameraDown =
        !cameraStream || !track || track.readyState === "ended" || video.videoWidth === 0;
      if (config.requireCamera && cameraDown) {
        cameraLostSinceRef.current = cameraLostSinceRef.current ?? now;
        if (now - cameraLostSinceRef.current > CAMERA_LOST_HOLD_MS) {
          cameraLostSinceRef.current = now; // avoid re-flag spam
          sendFlag("CAMERA_LOST", { details: "Camera feed lost during exam" });
        }
        return;
      }
      cameraLostSinceRef.current = null;

      if (!faceDetector || video.videoWidth === 0) return;

      try {
        const result = faceDetector.detectForVideo(video, now);
        const faces = result?.detections?.length ?? 0;

        // No face
        if (faces === 0) {
          noFaceSinceRef.current = noFaceSinceRef.current ?? now;
          if (now - noFaceSinceRef.current > NO_FACE_HOLD_MS) {
            noFaceSinceRef.current = now;
            captureSnapshot(video, "webcam").then((key) =>
              sendFlag("NO_FACE", {
                details: "No face detected",
                confidence: 0.8,
                evidenceKey: key || undefined,
              })
            );
          }
        } else {
          noFaceSinceRef.current = null;
        }

        // Multiple faces
        if (faces > 1) {
          multiFaceSinceRef.current = multiFaceSinceRef.current ?? now;
          if (now - multiFaceSinceRef.current > MULTI_FACE_HOLD_MS) {
            multiFaceSinceRef.current = now;
            const conf =
              result.detections[0]?.categories?.[0]?.score ?? 0.9;
            captureSnapshot(video, "webcam").then((key) =>
              sendFlag("MULTIPLE_FACES", {
                details: `${faces} faces detected`,
                confidence: Math.min(conf, 1),
                evidenceKey: key || undefined,
              })
            );
          }
        } else {
          multiFaceSinceRef.current = null;
        }
      } catch {
        /* transient detect error — ignore this tick */
      }
    };

    // ── Adaptive snapshot loop (baseline 15s, 5s when heightened) ──
    const runSnapshots = async () => {
      if (stoppedRef.current || !config.recordSnapshots) return;
      const now = Date.now();
      const interval =
        now < heightenedUntilRef.current ? HEIGHTENED_SNAPSHOT_MS : BASELINE_SNAPSHOT_MS;
      if (now - lastSnapshotRef.current < interval) return;
      lastSnapshotRef.current = now;
      if (config.requireCamera) await captureSnapshot(video, "webcam");
      if (config.requireScreen && screenVideo) await captureSnapshot(screenVideo, "screen");
    };

    initFaceDetection().then(() => {
      detectTimer = setInterval(runDetection, DETECT_INTERVAL_MS);
    });
    // Snapshot ticker checks frequently but only uploads on the adaptive cadence
    snapshotTimer = setInterval(runSnapshots, 1000);

    return () => {
      stoppedRef.current = true;
      if (detectTimer) clearInterval(detectTimer);
      if (snapshotTimer) clearInterval(snapshotTimer);
      try {
        faceDetector?.close?.();
      } catch {
        /* ignore */
      }
      cameraStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
      video.remove();
      screenVideo?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, config, cameraStream, screenStream, token]);

  return <>{children}</>;
}
