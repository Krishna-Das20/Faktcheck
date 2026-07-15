"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { AlertTriangle, Maximize, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface ProctorGuardProps {
  contestId: string;
  onAutoSubmit?: (reason: string) => void;
  enabled?: boolean;
  children: ReactNode;
}

// Browser-tier flag types raised by this component. The server accepts the
// full ProctorFlag superset (video/audio/screen come from ProctorMedia).
type FlagType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "WINDOW_BLUR"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "SCREENSHOT_ATTEMPT"
  | "MULTIPLE_MONITORS"
  | "EXTENDED_DISPLAY";

const FLAG_LABELS: Record<FlagType, string> = {
  TAB_SWITCH: "Tab Switch Detected",
  FULLSCREEN_EXIT: "Fullscreen Exit Detected",
  WINDOW_BLUR: "Window Focus Lost",
  COPY_ATTEMPT: "Copy Attempt Blocked",
  PASTE_ATTEMPT: "Paste Attempt Blocked",
  SCREENSHOT_ATTEMPT: "Screenshot Attempt Blocked",
  MULTIPLE_MONITORS: "Multiple Monitors Detected",
  EXTENDED_DISPLAY: "Extended Display Detected",
};

interface FlagPayload {
  type: FlagType;
  details?: string | null;
  confidence?: number;
}

export default function ProctorGuard({
  contestId,
  onAutoSubmit,
  enabled = true,
  children,
}: ProctorGuardProps) {
  const { token } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [flagType, setFlagType] = useState<FlagType | "">("");
  const [terminated, setTerminated] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isProcessingRef = useRef(false);
  const hasAutoSubmittedRef = useRef(false);
  // De-dupe passive checks (multi-monitor) so we don't spam the same flag
  const raisedOnceRef = useRef<Set<FlagType>>(new Set());

  // Load persisted risk from DB on mount (universal across sections)
  useEffect(() => {
    if (!token || !enabled) return;
    const loadState = async () => {
      try {
        const res = await fetch(`/api/contests/${contestId}/start`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.progress) {
          setRiskScore(data.progress.riskScore || 0);
          if (
            data.progress.status === "SUBMITTED" ||
            data.progress.terminationReason === "MALPRACTICE"
          ) {
            hasAutoSubmittedRef.current = true;
          }
        }
      } catch {
        console.error("Failed to load proctoring state");
      }
    };
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, token, enabled]);

  // Request fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.error("Fullscreen request failed:", error);
    }
  }, []);

  // Raise a proctoring flag — instant local feedback, server decides policy
  const raiseFlag = useCallback(
    async (payload: FlagPayload) => {
      if (isProcessingRef.current || hasAutoSubmittedRef.current || !enabled) return;
      isProcessingRef.current = true;

      setAlertCount((c) => c + 1);
      setFlagType(payload.type);
      setShowWarning(true);

      try {
        const res = await fetch(`/api/proctor/${contestId}/flag`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: payload.type,
            details: payload.details ?? null,
            confidence: payload.confidence ?? 1,
          }),
        });
        const data = await res.json();

        if (data.success) {
          setRiskScore(data.riskScore ?? 0);
          if (data.terminated) {
            hasAutoSubmittedRef.current = true;
            setTerminated(true);
            toast.error("Contest terminated due to proctoring violations!", {
              duration: 5000,
              icon: "🚫",
            });
            onAutoSubmit?.("MALPRACTICE");
          } else if (!data.warn) {
            // Below the warn threshold — auto-dismiss the transient notice
            setTimeout(() => setShowWarning(false), 1500);
          }
        }
      } catch (error) {
        console.error("Failed to record proctoring flag:", error);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [contestId, enabled, onAutoSubmit, token]
  );

  // ── Multi-monitor / extended-display detection (passive, no prompt) ──
  const checkDisplays = useCallback(() => {
    if (!enabled || hasAutoSubmittedRef.current) return;
    // screen.isExtended is a passive read (Chromium); getScreenDetails needs a
    // permission prompt and is done in the pre-exam system check instead.
    const isExtended = (window.screen as any)?.isExtended;
    if (isExtended && !raisedOnceRef.current.has("EXTENDED_DISPLAY")) {
      raisedOnceRef.current.add("EXTENDED_DISPLAY");
      raiseFlag({
        type: "EXTENDED_DISPLAY",
        details: "An extended/second display was detected",
      });
    }
  }, [enabled, raiseFlag]);

  // Handlers ---------------------------------------------------------------
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && enabled && !hasAutoSubmittedRef.current) {
      raiseFlag({ type: "TAB_SWITCH", details: "User switched to another tab" });
    }
  }, [enabled, raiseFlag]);

  const handleBlur = useCallback(() => {
    if (enabled && !hasAutoSubmittedRef.current) {
      setTimeout(() => {
        if (!document.hasFocus()) {
          raiseFlag({ type: "WINDOW_BLUR", details: "Window lost focus" });
        }
      }, 20);
    }
  }, [enabled, raiseFlag]);

  const handleFullscreenChange = useCallback(() => {
    const doc = document as any;
    const isNowFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement
    );
    setIsFullscreen(isNowFullscreen);
    if (!isNowFullscreen && enabled && !hasAutoSubmittedRef.current) {
      raiseFlag({ type: "FULLSCREEN_EXIT", details: "User exited fullscreen mode" });
    }
  }, [enabled, raiseFlag]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      if (
        e.key.toLowerCase() === "s" &&
        e.shiftKey &&
        (e.metaKey || e.getModifierState("Meta"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        raiseFlag({ type: "SCREENSHOT_ATTEMPT", details: "Windows+Shift+S snipping tool" });
        return;
      }
      if (e.key === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        raiseFlag({ type: "SCREENSHOT_ATTEMPT", details: "PrintScreen key" });
        return;
      }
      if (e.key.toLowerCase() === "s" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        raiseFlag({ type: "SCREENSHOT_ATTEMPT", details: "Ctrl+Shift+S screenshot" });
        return;
      }

      const blockedCombinations = [
        { key: "Escape" },
        { key: "F11" },
        { key: "Tab", alt: true },
        { key: "F4", alt: true },
        { key: "w", ctrl: true },
        { key: "t", ctrl: true },
        { key: "n", ctrl: true },
        { key: "r", ctrl: true },
        { key: "F5" },
        { key: "F12" },
        { key: "i", ctrl: true, shift: true },
        { key: "j", ctrl: true, shift: true },
        { key: "u", ctrl: true },
      ];

      const isBlocked = blockedCombinations.some((blocked) => {
        if ((blocked as any).alt && !e.altKey) return false;
        if ((blocked as any).ctrl && !e.ctrlKey) return false;
        if ((blocked as any).shift && !e.shiftKey) return false;
        return e.key.toLowerCase() === blocked.key.toLowerCase();
      });

      if (isBlocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [enabled, raiseFlag]
  );

  // Copy/paste — allowed inside the code editor; paste content is logged
  const handleCopyPaste = useCallback(
    (e: ClipboardEvent, type: "COPY_ATTEMPT" | "PASTE_ATTEMPT") => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isInCodeEditor =
        target.closest(".monaco-editor") ||
        target.closest("[data-allow-copy-paste]") ||
        target.classList.contains("monaco-editor") ||
        target.classList.contains("inputarea");

      if (isInCodeEditor) return; // Allow copy/paste in code editor

      e.preventDefault();

      // Log the pasted text (truncated) — catches ChatGPT copy-ins
      let details: string | null =
        type === "COPY_ATTEMPT" ? "User attempted to copy" : "User attempted to paste";
      if (type === "PASTE_ATTEMPT") {
        const pasted = e.clipboardData?.getData("text") || "";
        if (pasted) {
          const snippet = pasted.slice(0, 300).replace(/\s+/g, " ").trim();
          details = `Pasted text: "${snippet}${pasted.length > 300 ? "…" : ""}"`;
        }
      }
      raiseFlag({ type, details });
    },
    [enabled, raiseFlag]
  );

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    enterFullscreen();
    checkDisplays();
    const displayInterval = setInterval(checkDisplays, 10000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    const handleCopy = (e: Event) => handleCopyPaste(e as ClipboardEvent, "COPY_ATTEMPT");
    const handlePaste = (e: Event) => handleCopyPaste(e as ClipboardEvent, "PASTE_ATTEMPT");
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "You are in the middle of a proctored contest. Are you sure you want to leave?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      clearInterval(displayInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [
    enabled,
    enterFullscreen,
    checkDisplays,
    handleVisibilityChange,
    handleBlur,
    handleFullscreenChange,
    handleKeyDown,
    handleCopyPaste,
  ]);

  const handleDismissWarning = () => {
    setShowWarning(false);
    if (!terminated) enterFullscreen();
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Proctoring Status Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur px-4 py-2"
        style={{
          background: "rgba(var(--background-card-rgb, 15,23,42), 0.9)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" style={{ color: "#22C55E" }} />
            <span style={{ color: "var(--foreground-secondary)" }}>
              Proctored Mode Active
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {!isFullscreen && (
              <button
                onClick={enterFullscreen}
                className="flex items-center gap-1 transition-colors"
                style={{ color: "#EAB308" }}
                aria-label="Enter fullscreen"
              >
                <Maximize className="w-4 h-4" />
                Enter Fullscreen
              </button>
            )}
            <span
              style={{
                color: alertCount > 0 ? "#EF4444" : "var(--foreground-secondary)",
              }}
              aria-live="polite"
              title={`Risk score: ${riskScore}`}
            >
              Alerts: {alertCount}
            </span>
          </div>
        </div>
      </div>

      {/* Content with padding for status bar */}
      <div className="pt-12">{children}</div>

      {/* Warning Modal */}
      {showWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ background: "rgba(0,0,0,0.8)" }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="warning-title"
        >
          <div
            className="rounded-xl p-8 max-w-md mx-4 text-center animate-pulse"
            style={{
              background: "var(--background-card)",
              border: "2px solid #EF4444",
            }}
          >
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.2)" }}
            >
              <AlertTriangle className="w-12 h-12" style={{ color: "#EF4444" }} />
            </div>

            <h2
              id="warning-title"
              className="text-2xl font-bold mb-2"
              style={{ color: "#EF4444" }}
            >
              {terminated ? "Contest Terminated" : "Proctoring Alert"}
            </h2>

            <p
              className="text-xl font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              {flagType ? FLAG_LABELS[flagType as FlagType] : "Violation Detected"}
            </p>

            <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
              {terminated
                ? "Your contest has been auto-submitted due to repeated proctoring violations."
                : "Please stay on the exam window. Do not switch tabs, exit fullscreen, use a second screen, or click away. Repeated violations will end your attempt."}
            </p>

            {!terminated ? (
              <button
                onClick={handleDismissWarning}
                className="w-full py-3 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                style={{
                  background: "linear-gradient(135deg, var(--primary), #FF8C5A)",
                }}
              >
                <Maximize className="w-5 h-5" />
                Return to Exam
              </button>
            ) : (
              <p className="font-semibold" style={{ color: "#EF4444" }}>
                Redirecting to results...
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
