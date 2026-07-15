import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * ProctorFlag — the richer, superset successor to Violation.
 *
 * Every proctoring signal (browser event, camera/audio/screen detection) is
 * stored as a flag with a confidence and a risk weight. The sum of weights on
 * a ContestProgress is its riskScore; auto-termination becomes a threshold on
 * that score instead of a blunt 3-strike count.
 *
 * Media evidence (snapshots, clips, audio) lives in object storage — only the
 * object key is stored here.
 */

export const PROCTOR_FLAG_TYPES = [
  // Browser signals (superset of the legacy Violation.type enum)
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "SCREENSHOT_ATTEMPT",
  "MULTIPLE_MONITORS",
  "EXTENDED_DISPLAY",
  // Video signals
  "NO_FACE",
  "MULTIPLE_FACES",
  "LOOKING_AWAY",
  "OBJECT_DETECTED",
  "CAMERA_LOST",
  // Audio signals
  "VOICE_DETECTED",
  // Screen signals
  "SCREEN_SHARE_STOPPED",
] as const;

export type ProctorFlagType = (typeof PROCTOR_FLAG_TYPES)[number];

export const PROCTOR_FLAG_SOURCES = ["browser", "video", "audio", "screen"] as const;
export type ProctorFlagSource = (typeof PROCTOR_FLAG_SOURCES)[number];

export interface IProctorFlag extends Document {
  contestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: ProctorFlagType;
  source: ProctorFlagSource;
  confidence: number; // 0–1 (1 for deterministic browser events)
  weight: number; // risk contribution
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  evidenceKey: string | null; // object-store key for snapshot/clip/audio
  details: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const proctorFlagSchema = new Schema<IProctorFlag>(
  {
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: PROCTOR_FLAG_TYPES, required: true },
    source: { type: String, enum: PROCTOR_FLAG_SOURCES, required: true },
    confidence: { type: Number, default: 1, min: 0, max: 1 },
    weight: { type: Number, required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    evidenceKey: { type: String, default: null },
    details: { type: String, default: null },
  },
  { timestamps: true }
);

proctorFlagSchema.index({ contestId: 1, userId: 1, startedAt: -1 });
proctorFlagSchema.index({ contestId: 1, startedAt: -1 });

const ProctorFlag: Model<IProctorFlag> =
  mongoose.models.ProctorFlag ||
  mongoose.model<IProctorFlag>("ProctorFlag", proctorFlagSchema);

export default ProctorFlag;
