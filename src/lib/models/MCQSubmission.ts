import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMCQSubmissionAnswer {
  mcqId: mongoose.Types.ObjectId;
  selectedOptions: number[];
  timeSpent: number;
}

export interface IMCQSubmission extends Document {
  contestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  answers: IMCQSubmissionAnswer[];
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  totalTimeSpent: number;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mcqSubmissionSchema = new Schema<IMCQSubmission>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: [
      {
        mcqId: { type: Schema.Types.ObjectId, ref: "MCQ" },
        selectedOptions: [Number],
        timeSpent: { type: Number, default: 0 },
      },
    ],
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

mcqSubmissionSchema.index({ contestId: 1, userId: 1 }, { unique: true });

const MCQSubmission: Model<IMCQSubmission> =
  mongoose.models.MCQSubmission ||
  mongoose.model<IMCQSubmission>("MCQSubmission", mcqSubmissionSchema);

export default MCQSubmission;
