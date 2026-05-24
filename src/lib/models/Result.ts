import mongoose, { Schema, Document, Model } from "mongoose";

export interface IResult extends Document {
  userId: mongoose.Types.ObjectId;
  contestId: mongoose.Types.ObjectId;
  mcqScore: number;
  mcqAnswers: {
    questionId: mongoose.Types.ObjectId;
    selectedOptions: number[];
    isCorrect: boolean;
    marksAwarded: number;
    timeTaken: number;
  }[];
  codingScore: number;
  codingSubmissions: {
    problemId: mongoose.Types.ObjectId;
    bestSubmission: mongoose.Types.ObjectId;
    score: number;
    attempts: number;
    solved: boolean;
  }[];
  formsScore: number;
  isFormsEvaluated: boolean;
  totalScore: number;
  rank: number | null;
  timeTaken: number;
  startedAt: Date | null;
  submittedAt: Date | null;
  status: "REGISTERED" | "IN_PROGRESS" | "SUBMITTED" | "EVALUATED";
  certificateGenerated: boolean;
  certificateUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<IResult>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    mcqScore: { type: Number, default: 0 },
    mcqAnswers: [
      {
        questionId: { type: Schema.Types.ObjectId, ref: "MCQ" },
        selectedOptions: [Number],
        isCorrect: Boolean,
        marksAwarded: Number,
        timeTaken: Number,
      },
    ],
    codingScore: { type: Number, default: 0 },
    codingSubmissions: [
      {
        problemId: { type: Schema.Types.ObjectId, ref: "CodingProblem" },
        bestSubmission: { type: Schema.Types.ObjectId, ref: "Submission" },
        score: Number,
        attempts: Number,
        solved: Boolean,
      },
    ],
    formsScore: { type: Number, default: 0 },
    isFormsEvaluated: { type: Boolean, default: true },
    totalScore: { type: Number, default: 0 },
    rank: { type: Number, default: null },
    timeTaken: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["REGISTERED", "IN_PROGRESS", "SUBMITTED", "EVALUATED"],
      default: "IN_PROGRESS",
    },
    certificateGenerated: { type: Boolean, default: false },
    certificateUrl: { type: String, default: null },
  },
  { timestamps: true }
);

resultSchema.index({ userId: 1, contestId: 1 }, { unique: true });
resultSchema.index({ contestId: 1, totalScore: -1, timeTaken: 1 });

const Result: Model<IResult> =
  mongoose.models.Result || mongoose.model<IResult>("Result", resultSchema);

export default Result;
