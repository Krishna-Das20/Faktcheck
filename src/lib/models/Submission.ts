import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITestcaseResult {
  testcaseId: mongoose.Types.ObjectId;
  passed: boolean;
  executionTime?: number;
  memoryUsed?: number;
  error?: string;
}

export interface ISubmission extends Document {
  userId: mongoose.Types.ObjectId;
  contestId: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  sourceCode: string;
  language: "c" | "cpp" | "java" | "python" | "javascript" | "go" | "rust";
  languageId: number;
  verdict:
    | "PENDING"
    | "ACCEPTED"
    | "WRONG_ANSWER"
    | "TIME_LIMIT_EXCEEDED"
    | "MEMORY_LIMIT_EXCEEDED"
    | "RUNTIME_ERROR"
    | "COMPILATION_ERROR"
    | "JUDGE0_UNAVAILABLE";
  score: number;
  testcasesPassed: number;
  totalTestcases: number;
  executionTime: number | null;
  memoryUsed: number | null;
  errorMessage: string | null;
  testcaseResults: ITestcaseResult[];
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contestId: { type: Schema.Types.ObjectId, ref: "Contest", required: true },
    problemId: { type: Schema.Types.ObjectId, ref: "CodingProblem", required: true },
    sourceCode: { type: String, required: true },
    language: {
      type: String,
      required: true,
      enum: ["c", "cpp", "java", "python", "javascript", "go", "rust"],
    },
    languageId: { type: Number, required: true },
    verdict: {
      type: String,
      enum: [
        "PENDING", "ACCEPTED", "WRONG_ANSWER", "TIME_LIMIT_EXCEEDED",
        "MEMORY_LIMIT_EXCEEDED", "RUNTIME_ERROR", "COMPILATION_ERROR", "JUDGE0_UNAVAILABLE",
      ],
      default: "PENDING",
    },
    score: { type: Number, default: 0 },
    testcasesPassed: { type: Number, default: 0 },
    totalTestcases: { type: Number, default: 0 },
    executionTime: { type: Number, default: null },
    memoryUsed: { type: Number, default: null },
    errorMessage: { type: String, default: null },
    testcaseResults: [
      {
        testcaseId: Schema.Types.ObjectId,
        passed: Boolean,
        executionTime: Number,
        memoryUsed: Number,
        error: String,
      },
    ],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

submissionSchema.index({ userId: 1, contestId: 1, problemId: 1 });
submissionSchema.index({ contestId: 1, verdict: 1 });

const Submission: Model<ISubmission> =
  mongoose.models.Submission || mongoose.model<ISubmission>("Submission", submissionSchema);

export default Submission;
