import mongoose, { Schema, Document, Model } from "mongoose";

export type ViolationType =
  | "TAB_SWITCH"
  | "FULLSCREEN_EXIT"
  | "WINDOW_BLUR"
  | "COPY_ATTEMPT"
  | "PASTE_ATTEMPT"
  | "SCREENSHOT_ATTEMPT";

export interface IViolation extends Document {
  userId: mongoose.Types.ObjectId;
  contestId: mongoose.Types.ObjectId;
  type: ViolationType;
  warningNumber: number;
  details: string | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const violationSchema = new Schema<IViolation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    type: {
      type: String,
      enum: [
        "TAB_SWITCH", "FULLSCREEN_EXIT", "WINDOW_BLUR",
        "COPY_ATTEMPT", "PASTE_ATTEMPT", "SCREENSHOT_ATTEMPT",
      ],
      required: true,
    },
    warningNumber: { type: Number, required: true },
    details: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

violationSchema.index({ userId: 1, contestId: 1 });
violationSchema.index({ contestId: 1, timestamp: -1 });

const Violation: Model<IViolation> =
  mongoose.models.Violation || mongoose.model<IViolation>("Violation", violationSchema);

export default Violation;
