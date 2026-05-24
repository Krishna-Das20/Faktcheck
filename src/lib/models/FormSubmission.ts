import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-schema ───────────────────────────────────────────

export interface IFormResponse {
  fieldId: string;
  value: unknown;
  isAutoScored: boolean;
  autoScore: number;
  manualScore: number | null;
  maxMarks: number;
  isEvaluated: boolean;
  feedback: string;
}

export interface IFormSubmission extends Document {
  formId: mongoose.Types.ObjectId;
  contestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  responses: IFormResponse[];
  totalAutoScore: number;
  totalManualScore: number;
  totalScore: number;
  maxPossibleScore: number;
  isFullyEvaluated: boolean;
  evaluatedBy: mongoose.Types.ObjectId | null;
  evaluatedAt: Date | null;
  submittedAt: Date;
  notifyOnEvaluate: boolean;
  timeTaken: number;
  createdAt: Date;
  updatedAt: Date;
}

const responseSchema = new Schema(
  {
    fieldId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    isAutoScored: { type: Boolean, default: false },
    autoScore: { type: Number, default: 0 },
    manualScore: { type: Number, default: null },
    maxMarks: { type: Number, default: 0 },
    isEvaluated: { type: Boolean, default: false },
    feedback: { type: String, default: "" },
  },
  { _id: false }
);

const formSubmissionSchema = new Schema<IFormSubmission>(
  {
    formId: { type: Schema.Types.ObjectId, ref: "Form", required: true },
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    responses: [responseSchema],
    totalAutoScore: { type: Number, default: 0 },
    totalManualScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    maxPossibleScore: { type: Number, default: 0 },
    isFullyEvaluated: { type: Boolean, default: false },
    evaluatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    evaluatedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    notifyOnEvaluate: { type: Boolean, default: true },
    timeTaken: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Calculate scores before saving
formSubmissionSchema.pre("save", function () {
  let autoScore = 0;
  let manualScore = 0;
  let maxScore = 0;
  let allManualEvaluated = true;
  let hasManualFields = false;

  this.responses.forEach((response) => {
    maxScore += response.maxMarks || 0;
    if (response.isAutoScored) {
      autoScore += response.autoScore || 0;
    } else {
      hasManualFields = true;
      if (response.isEvaluated) {
        manualScore += response.manualScore || 0;
      } else {
        allManualEvaluated = false;
      }
    }
  });

  this.totalAutoScore = autoScore;
  this.totalManualScore = manualScore;
  this.totalScore = autoScore + manualScore;
  this.maxPossibleScore = maxScore;
  this.isFullyEvaluated = hasManualFields ? allManualEvaluated : true;
});

formSubmissionSchema.index({ contestId: 1, userId: 1 });
formSubmissionSchema.index({ formId: 1, userId: 1 }, { unique: true });

const FormSubmission: Model<IFormSubmission> =
  mongoose.models.FormSubmission ||
  mongoose.model<IFormSubmission>("FormSubmission", formSubmissionSchema);

export default FormSubmission;
