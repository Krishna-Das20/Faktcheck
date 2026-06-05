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

type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "WINDOW_BLUR"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "SCREENSHOT_ATTEMPT";

const VIOLATION_LABELS: Record<ViolationType, string> = {
  TAB_SWITCH: "Tab Switch Detected",
  FULLSCREEN_EXIT: "Fullscreen Exit Detected",
  WINDOW_BLUR: "Window Focus Lost",
  COPY_ATTEMPT: "Copy Attempt Blocked",
  PASTE_ATTEMPT: "Paste Attempt Blocked",
  SCREENSHOT_ATTEMPT: "Screenshot Attempt Blocked",
};

export default function ProctorGuard({
  contestId,
  onAutoSubmit,
  enabled = true,
  children,
}: ProctorGuardProps) {
  const { token } = useAuth();
  const [warningCount, setWarningCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [violationType, setViolationType] = useState<ViolationType | "">("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const maxWarnings = 3;
  const isProcessingRef = useRef(false);
  const hasAutoSubmittedRef = useRef(false);
  const warningCountRef = useRef(0);

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

  // Log violation — INSTANT warning, async API call
  const logViolation = useCallback(
    async (type: ViolationType, details: string | null = null) => {
      if (isProcessingRef.current || hasAutoSubmittedRef.current) return;
      isProcessingRef.current = true;

      // Use ref for accurate count (avoids stale closure on rapid events)
      const newWarningCount = warningCountRef.current + 1;
      warningCountRef.current = newWarningCount;
      setWarningCount(newWarningCount);
      setViolationType(type);
      setShowWarning(true);

      // Check if max warnings reached
      if (newWarningCount >= maxWarnings) {
        hasAutoSubmittedRef.current = true;
        toast.error("Contest terminated due to malpractice!", {
          duration: 5000,
          icon: "🚫",
        });
        if (onAutoSubmit) {
          onAutoSubmit("MALPRACTICE");
        }
      }

      // Log to API in background (non-blocking)
      try {
        await fetch(`/api/contests/${contestId}/violation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type, details }),
        });
      } catch (error) {
        console.error("Failed to log violation:", error);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [contestId, onAutoSubmit, token]
  );

  // Handle visibility change (tab switch)
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && enabled && !hasAutoSubmittedRef.current) {
      logViolation("TAB_SWITCH", "User switched to another tab");
    }
  }, [enabled, logViolation]);

  // Handle window blur (clicking outside) — minimal delay to filter double-events
  const handleBlur = useCallback(() => {
    if (enabled && !hasAutoSubmittedRef.current) {
      setTimeout(() => {
        if (!document.hasFocus()) {
          logViolation("WINDOW_BLUR", "Window lost focus");
        }
      }, 20);
    }
  }, [enabled, logViolation]);

  // Handle fullscreen change
  const handleFullscreenChange = useCallback(() => {
    const doc = document as any;
    const isNowFullscreen = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement
    );

    setIsFullscreen(isNowFullscreen);

    if (!isNowFullscreen && enabled && !hasAutoSubmittedRef.current) {
      logViolation("FULLSCREEN_EXIT", "User exited fullscreen mode");
    }
  }, [enabled, logViolation]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Win+Shift+S (Snipping Tool)
      if (
        e.key.toLowerCase() === "s" &&
        e.shiftKey &&
        (e.metaKey || e.getModifierState("Meta"))
      ) {
        e.preventDefault();
        e.stopPropagation();
        logViolation(
          "SCREENSHOT_ATTEMPT",
          "User attempted Windows+Shift+S snipping tool"
        );
        return;
      }

      // PrintScreen
      if (e.key === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        logViolation(
          "SCREENSHOT_ATTEMPT",
          "User attempted PrintScreen screenshot"
        );
        return;
      }

      // Ctrl+Shift+S
      if (e.key.toLowerCase() === "s" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        logViolation(
          "SCREENSHOT_ATTEMPT",
          "User attempted Ctrl+Shift+S screenshot"
        );
        return;
      }

      // Block common navigation shortcuts
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
    [enabled, logViolation]
  );

  // Handle copy/paste attempts - allow only in code editor (matches KK behavior)
  const handleCopyPaste = useCallback(
    (e: ClipboardEvent, type: ViolationType) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;
      const isInCodeEditor =
        target.closest(".monaco-editor") ||
        target.closest("[data-allow-copy-paste]") ||
        target.classList.contains("monaco-editor") ||
        target.classList.contains("inputarea");

      if (isInCodeEditor) return; // Allow copy/paste in code editor

      e.preventDefault();
      logViolation(type, `User attempted to ${type.toLowerCase().replace("_", " ")}`);
    },
    [enabled, logViolation]
  );

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    // Enter fullscreen on mount
    enterFullscreen();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener(
      "webkitfullscreenchange",
      handleFullscreenChange
    );
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
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [
    enabled,
    enterFullscreen,
    handleVisibilityChange,
    handleBlur,
    handleFullscreenChange,
    handleKeyDown,
    handleCopyPaste,
  ]);

  // Dismiss warning and re-enter fullscreen
  const handleDismissWarning = () => {
    setShowWarning(false);
    if (warningCount < maxWarnings) {
      enterFullscreen();
    }
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
                color: warningCount > 0 ? "#EF4444" : "var(--foreground-secondary)",
              }}
              aria-live="polite"
            >
              Warnings: {warningCount}/{maxWarnings}
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
              Warning {warningCount}/{maxWarnings}
            </h2>

            <p
              className="text-xl font-semibold mb-2"
              style={{ color: "var(--foreground)" }}
            >
              {violationType ? VIOLATION_LABELS[violationType as ViolationType] : "Violation Detected"}
            </p>

            <p
              className="mb-6"
              style={{ color: "var(--foreground-secondary)" }}
            >
              {warningCount >= maxWarnings
                ? "Maximum warnings reached. Your contest has been auto-submitted due to malpractice."
                : "Please return to the exam. Do not switch tabs, exit fullscreen, or click outside the exam window."}
            </p>

            {warningCount < maxWarnings ? (
              <button
                onClick={handleDismissWarning}
                className="w-full py-3 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), #FF8C5A)",
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
