import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────

interface IQuestionTime {
  questionId: mongoose.Types.ObjectId;
  timeSpent: number;
  startedAt?: Date;
  answeredAt?: Date;
}

interface IProblemTime {
  problemId: mongoose.Types.ObjectId;
  timeSpent: number;
  startedAt?: Date;
  submittedAt?: Date;
}

interface IMCQAnswer {
  mcqId: mongoose.Types.ObjectId;
  selectedOptions: number[];
}

type SectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";

// ─── Main Interface ───────────────────────────────────────

export interface IContestProgress extends Document {
  contestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  startedAt: Date;
  submittedAt?: Date;
  totalTimeSpent: number;
  mcqProgress: {
    sectionStartedAt?: Date;
    sectionSubmittedAt?: Date;
    sectionStatus: SectionStatus;
    sectionTimeSpent: number;
    questionTimes: IQuestionTime[];
    categoryTimes: { category: string; timeSpent: number }[];
    answers: IMCQAnswer[];
  };
  codingProgress: {
    sectionStartedAt?: Date;
    sectionSubmittedAt?: Date;
    sectionStatus: SectionStatus;
    sectionTimeSpent: number;
    problemTimes: IProblemTime[];
  };
  formsProgress: {
    sectionStartedAt?: Date;
    sectionSubmittedAt?: Date;
    sectionStatus: SectionStatus;
    sectionTimeSpent: number;
  };
  status: "IN_PROGRESS" | "SUBMITTED" | "TIMED_OUT";
  warningCount: number;
  terminationReason: "COMPLETED" | "TIMEOUT" | "MALPRACTICE" | null;
  proctorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const questionTimeSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, required: true },
    timeSpent: { type: Number, default: 0 },
    startedAt: Date,
    answeredAt: Date,
  },
  { _id: false }
);

const problemTimeSchema = new Schema(
  {
    problemId: { type: Schema.Types.ObjectId, required: true },
    timeSpent: { type: Number, default: 0 },
    startedAt: Date,
    submittedAt: Date,
  },
  { _id: false }
);

const sectionStatusEnum = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED"];

const contestProgressSchema = new Schema<IContestProgress>(
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
    startedAt: {
      type: Date,
      required: true,
    },
    submittedAt: Date,
    totalTimeSpent: {
      type: Number,
      default: 0,
    },
    mcqProgress: {
      sectionStartedAt: Date,
      sectionSubmittedAt: Date,
      sectionStatus: { type: String, enum: sectionStatusEnum, default: "NOT_STARTED" },
      sectionTimeSpent: { type: Number, default: 0 },
      questionTimes: [questionTimeSchema],
      categoryTimes: [
        {
          category: { type: String, required: true },
          timeSpent: { type: Number, default: 0 },
          _id: false,
        },
      ],
      answers: [
        {
          mcqId: Schema.Types.ObjectId,
          selectedOptions: [Number],
        },
      ],
    },
    codingProgress: {
      sectionStartedAt: Date,
      sectionSubmittedAt: Date,
      sectionStatus: { type: String, enum: sectionStatusEnum, default: "NOT_STARTED" },
      sectionTimeSpent: { type: Number, default: 0 },
      problemTimes: [problemTimeSchema],
    },
    formsProgress: {
      sectionStartedAt: Date,
      sectionSubmittedAt: Date,
      sectionStatus: { type: String, enum: sectionStatusEnum, default: "NOT_STARTED" },
      sectionTimeSpent: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "TIMED_OUT"],
      default: "IN_PROGRESS",
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    terminationReason: {
      type: String,
      enum: ["COMPLETED", "TIMEOUT", "MALPRACTICE", null],
      default: null,
    },
    proctorEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index for unique user-contest combination
contestProgressSchema.index({ contestId: 1, userId: 1 }, { unique: true });

const ContestProgress: Model<IContestProgress> =
  mongoose.models.ContestProgress ||
  mongoose.model<IContestProgress>("ContestProgress", contestProgressSchema);

export default ContestProgress;
