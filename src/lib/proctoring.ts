import type { ProctorFlagType } from "@/lib/models/ProctorFlag";

/**
 * Risk weights per flag type. The sum of a candidate's flag weights is their
 * riskScore. Tuned so a benign OS-notification blur barely moves the needle,
 * while a phone in frame or multiple faces is close to decisive.
 *
 * These are deliberately conservative starting values — expose them per-contest
 * later if organisers want stricter/looser policies.
 */
export const RISK_WEIGHTS: Record<ProctorFlagType, number> = {
  // Browser
  WINDOW_BLUR: 1,
  TAB_SWITCH: 5,
  FULLSCREEN_EXIT: 5,
  COPY_ATTEMPT: 3,
  PASTE_ATTEMPT: 4,
  SCREENSHOT_ATTEMPT: 8,
  MULTIPLE_MONITORS: 15,
  EXTENDED_DISPLAY: 10,
  // Video
  LOOKING_AWAY: 3,
  NO_FACE: 8,
  MULTIPLE_FACES: 20,
  OBJECT_DETECTED: 25,
  CAMERA_LOST: 10,
  // Audio
  VOICE_DETECTED: 8,
  // Screen
  SCREEN_SHARE_STOPPED: 15,
};

/** Which detection layer produced each flag type (for reporting/grouping). */
export const FLAG_SOURCE: Record<ProctorFlagType, "browser" | "video" | "audio" | "screen"> = {
  WINDOW_BLUR: "browser",
  TAB_SWITCH: "browser",
  FULLSCREEN_EXIT: "browser",
  COPY_ATTEMPT: "browser",
  PASTE_ATTEMPT: "browser",
  SCREENSHOT_ATTEMPT: "browser",
  MULTIPLE_MONITORS: "browser",
  EXTENDED_DISPLAY: "browser",
  LOOKING_AWAY: "video",
  NO_FACE: "video",
  MULTIPLE_FACES: "video",
  OBJECT_DETECTED: "video",
  CAMERA_LOST: "video",
  VOICE_DETECTED: "audio",
  SCREEN_SHARE_STOPPED: "screen",
};

/** Show the candidate a warning modal once cumulative risk crosses this. */
export const RISK_WARN_THRESHOLD = 15;

/** Auto-terminate the attempt at or above this cumulative risk. */
export const RISK_TERMINATE_THRESHOLD = 60;

/**
 * A single flag of one of these types is severe enough to terminate on its own,
 * regardless of cumulative score (e.g. a phone clearly in frame).
 */
export const CATASTROPHIC_FLAGS: ProctorFlagType[] = ["OBJECT_DETECTED", "MULTIPLE_FACES"];

/** Human-readable labels for the reviewer dashboard and candidate warnings. */
export const FLAG_LABELS: Record<ProctorFlagType, string> = {
  WINDOW_BLUR: "Window Focus Lost",
  TAB_SWITCH: "Tab Switch Detected",
  FULLSCREEN_EXIT: "Fullscreen Exit Detected",
  COPY_ATTEMPT: "Copy Attempt Blocked",
  PASTE_ATTEMPT: "Paste Attempt Blocked",
  SCREENSHOT_ATTEMPT: "Screenshot Attempt Blocked",
  MULTIPLE_MONITORS: "Multiple Monitors Detected",
  EXTENDED_DISPLAY: "Extended Display Detected",
  LOOKING_AWAY: "Looking Away From Screen",
  NO_FACE: "No Face Detected",
  MULTIPLE_FACES: "Multiple Faces Detected",
  OBJECT_DETECTED: "Prohibited Object Detected",
  CAMERA_LOST: "Camera Feed Lost",
  VOICE_DETECTED: "Background Voice Detected",
  SCREEN_SHARE_STOPPED: "Screen Sharing Stopped",
};

export function weightForFlag(type: ProctorFlagType, confidence = 1): number {
  const base = RISK_WEIGHTS[type] ?? 5;
  // Scale by confidence for probabilistic (ML) signals; browser events are 1.
  return Math.round(base * Math.min(Math.max(confidence, 0), 1));
}
