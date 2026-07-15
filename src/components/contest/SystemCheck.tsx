"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, Maximize, Monitor, ShieldCheck, CheckCircle,
  XCircle, Loader2, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export interface MediaProctoringConfig {
  enabled: boolean;
  requireCamera: boolean;
  requireScreen: boolean;
  requireIdentityPhoto: boolean;
  recordSnapshots: boolean;
  detectAudio: boolean;
}

interface SystemCheckProps {
  contestId: string;
  config: MediaProctoringConfig;
  /** Called with the granted media stream(s) once every check passes + consent given. */
  onReady: (streams: { camera: MediaStream | null; screen: MediaStream | null }) => void;
}

type CheckStatus = "pending" | "checking" | "pass" | "fail";

interface CheckState {
  camera: CheckStatus;
  mic: CheckStatus;
  fullscreen: CheckStatus;
  monitors: CheckStatus;
  screen: CheckStatus;
}

const dot = (s: CheckStatus) => {
  if (s === "pass") return <CheckCircle className="w-5 h-5" style={{ color: "#22C55E" }} />;
  if (s === "fail") return <XCircle className="w-5 h-5" style={{ color: "#EF4444" }} />;
  if (s === "checking") return <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />;
  return <div className="w-5 h-5 rounded-full" style={{ border: "2px solid var(--border)" }} />;
};

export default function SystemCheck({ contestId, config, onReady }: SystemCheckProps) {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const [checks, setChecks] = useState<CheckState>({
    camera: config.requireCamera ? "pending" : "pass",
    mic: config.detectAudio ? "pending" : "pass",
    fullscreen: "pending",
    monitors: "pending",
    screen: config.requireScreen ? "pending" : "pass",
  });
  const [micLevel, setMicLevel] = useState(0);
  const [consent, setConsent] = useState(false);
  const [identityPhoto, setIdentityPhoto] = useState<Blob | null>(null);
  const [identityPreview, setIdentityPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setCheck = (k: keyof CheckState, v: CheckStatus) =>
    setChecks((prev) => ({ ...prev, [k]: v }));

  // ── Camera + mic ────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!config.requireCamera && !config.detectAudio) return;
    setCheck("camera", config.requireCamera ? "checking" : "pass");
    setCheck("mic", config.detectAudio ? "checking" : "pass");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: config.requireCamera ? { width: 640, height: 480, frameRate: 15 } : false,
        audio: config.detectAudio || config.requireCamera,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current && config.requireCamera) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (config.requireCamera) setCheck("camera", "pass");

      // Mic level meter
      if (config.detectAudio && stream.getAudioTracks().length > 0) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(data);
          const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
          setMicLevel(Math.min(100, Math.round((rms / 128) * 100)));
          rafRef.current = requestAnimationFrame(loop);
        };
        loop();
        setCheck("mic", "pass");
      }
    } catch {
      if (config.requireCamera) setCheck("camera", "fail");
      if (config.detectAudio) setCheck("mic", "fail");
    }
  }, [config.requireCamera, config.detectAudio]);

  // ── Fullscreen ──────────────────────────────────────────────
  const checkFullscreen = useCallback(async () => {
    setCheck("fullscreen", "checking");
    try {
      await document.documentElement.requestFullscreen();
      setCheck("fullscreen", "pass");
    } catch {
      setCheck("fullscreen", "fail");
    }
  }, []);

  // ── Multi-monitor ───────────────────────────────────────────
  const checkMonitors = useCallback(async () => {
    setCheck("monitors", "checking");
    try {
      // Prefer the precise Window Management API when available
      if ("getScreenDetails" in window) {
        const details = await (window as any).getScreenDetails();
        setCheck("monitors", details.screens.length > 1 ? "fail" : "pass");
        return;
      }
      setCheck("monitors", (window.screen as any).isExtended ? "fail" : "pass");
    } catch {
      // Permission denied — fall back to the passive signal
      setCheck("monitors", (window.screen as any).isExtended ? "fail" : "pass");
    }
  }, []);

  // ── Screen share ────────────────────────────────────────────
  const checkScreen = useCallback(async () => {
    if (!config.requireScreen) return;
    setCheck("screen", "checking");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
      });
      const surface = stream.getVideoTracks()[0]?.getSettings?.().displaySurface;
      if (surface && surface !== "monitor") {
        stream.getTracks().forEach((t) => t.stop());
        setCheck("screen", "fail");
        toast.error("Please share your entire screen, not a single window or tab.");
        return;
      }
      screenStreamRef.current = stream;
      setCheck("screen", "pass");
    } catch {
      setCheck("screen", "fail");
    }
  }, [config.requireScreen]);

  // Capture identity still from the live camera
  const captureIdentity = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("Camera not ready yet");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setIdentityPhoto(blob);
        setIdentityPreview(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.7
    );
  }, []);

  // Run passive checks on mount
  useEffect(() => {
    checkMonitors();
    startCamera();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requiredChecks: (keyof CheckState)[] = [
    ...(config.requireCamera ? (["camera"] as const) : []),
    ...(config.detectAudio ? (["mic"] as const) : []),
    "fullscreen",
    ...(config.requireScreen ? (["screen"] as const) : []),
  ];
  // Monitors is a soft warning, not a hard block (many devices report extended).
  const allRequiredPass = requiredChecks.every((k) => checks[k] === "pass");
  const identityReady = !config.requireIdentityPhoto || !!identityPhoto;
  const canProceed = allRequiredPass && consent && identityReady;

  const handleProceed = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("consent", "true");
      if (identityPhoto) form.append("photo", identityPhoto, "identity.jpg");
      const res = await fetch(`/api/proctor/${contestId}/identity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to record consent");
        setSubmitting(false);
        return;
      }
      onReady({
        camera: cameraStreamRef.current,
        screen: screenStreamRef.current,
      });
    } catch {
      toast.error("Failed to start proctoring");
      setSubmitting(false);
    }
  };

  const row = (
    key: keyof CheckState,
    icon: React.ReactNode,
    label: string,
    hint: string,
    retry?: () => void
  ) => (
    <div
      className="flex items-center gap-4 p-4 rounded-xl"
      style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}
    >
      <div style={{ color: "var(--foreground-secondary)" }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ color: "var(--foreground)" }}>{label}</div>
        <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
          {checks[key] === "fail" ? hint : label}
        </div>
      </div>
      {checks[key] === "fail" && retry && (
        <button onClick={retry} className="p-2 rounded-lg" title="Retry" style={{ color: "var(--primary)" }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
      {dot(checks[key])}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: "rgba(var(--primary-rgb,255,107,53),0.15)" }}>
            <ShieldCheck className="w-7 h-7" style={{ color: "var(--primary)" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>System Check</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
            This is a proctored exam. Complete the checks below to continue.
          </p>
        </div>

        {config.requireCamera && (
          <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", aspectRatio: "16/9", maxHeight: 260, background: "#000" }}>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
          </div>
        )}

        <div className="space-y-3">
          {config.requireCamera &&
            row("camera", <Camera className="w-5 h-5" />, "Camera access", "Allow camera access from the address bar, then retry.", startCamera)}
          {config.detectAudio && (
            <div className="p-4 rounded-xl" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-4">
                <Monitor className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />
                <div className="flex-1">
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>Microphone</div>
                  <div className="h-2 rounded-full mt-2 overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${micLevel}%`, background: "#22C55E" }} />
                  </div>
                </div>
                {dot(checks.mic)}
              </div>
            </div>
          )}
          {row("fullscreen", <Maximize className="w-5 h-5" />, "Fullscreen mode", "Fullscreen was blocked. Click retry to enable it.", checkFullscreen)}
          {row("monitors", <Monitor className="w-5 h-5" />, "Single display", "A second monitor was detected — disconnect it to avoid flags.", checkMonitors)}
          {config.requireScreen &&
            row("screen", <Monitor className="w-5 h-5" />, "Screen sharing", "Share your entire screen (not a window/tab), then retry.", checkScreen)}
        </div>

        {/* Fullscreen / screen need a user gesture — surface buttons if pending */}
        <div className="flex flex-wrap gap-2 mt-3">
          {checks.fullscreen !== "pass" && (
            <button onClick={checkFullscreen} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              Enable Fullscreen
            </button>
          )}
          {config.requireScreen && checks.screen !== "pass" && (
            <button onClick={checkScreen} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              Share Screen
            </button>
          )}
        </div>

        {/* Identity capture */}
        {config.requireIdentityPhoto && config.requireCamera && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-4">
              {identityPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={identityPreview} alt="Identity" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ border: "1px dashed var(--border)" }}>
                  <Camera className="w-6 h-6" style={{ color: "var(--foreground-secondary)" }} />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium" style={{ color: "var(--foreground)" }}>Identity photo</div>
                <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                  {identityPhoto ? "Captured — retake if it's unclear." : "Take a clear photo of your face."}
                </div>
              </div>
              <button
                onClick={captureIdentity}
                disabled={checks.camera !== "pass"}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {identityPhoto ? "Retake" : "Capture"}
              </button>
            </div>
          </div>
        )}

        {/* Consent */}
        <label className="flex items-start gap-3 mt-4 p-4 rounded-xl cursor-pointer" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
            I consent to being monitored during this exam. I understand my{" "}
            {config.requireCamera ? "camera" : ""}
            {config.detectAudio ? (config.requireCamera ? ", microphone" : "microphone") : ""}
            {config.requireScreen ? " and screen" : ""} may be recorded and reviewed for integrity purposes, and that this data is stored securely and deleted after the review period.
          </span>
        </label>

        {checks.monitors === "fail" && (
          <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: "#EAB308" }}>
            <AlertTriangle className="w-4 h-4" />
            A second display is still detected. You may proceed, but it will be flagged for review.
          </div>
        )}

        <button
          onClick={handleProceed}
          disabled={!canProceed || submitting}
          className="w-full mt-5 py-3 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          {submitting ? "Starting…" : "Start Proctored Exam"}
        </button>
      </div>
    </div>
  );
}
