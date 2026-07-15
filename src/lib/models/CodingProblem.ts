import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITestcase {
  input: string;
  output: string;
  hidden: boolean;
  points: number;
}

export interface IExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface ICodingImage {
  url: string;
  publicId: string;
}

export interface ICodingProblem extends Document {
  contestId: mongoose.Types.ObjectId | null;
  isLibrary: boolean;
  isPublic: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: IExample[];
  testcases: ITestcase[];
  score: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category: "GENERAL" | "DSA" | "ALGORITHMS" | "DATABASE" | "SYSTEM_DESIGN";
  timeLimit: number;
  memoryLimit: number;
  tags: string[];
  imageUrl: string | null;
  imagePublicId: string | null;
  images: ICodingImage[];
  order: number;
  metrics: {
    attempted: number;
    accepted: number;
    wrongAnswer: number;
    tle: number;
    runtimeError: number;
  };
  submissionCount: number;
  acceptedCount: number;
  acceptanceRate: string; // virtual
  createdAt: Date;
  updatedAt: Date;
}

const codingProblemSchema = new Schema<ICodingProblem>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      default: null,
    },
    isLibrary: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: {
      type: String,
      required: [true, "Problem title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Problem description is required"],
    },
    inputFormat: { type: String, required: true },
    outputFormat: { type: String, required: true },
    constraints: [{ type: String }],
    examples: [
      {
        input: String,
        output: String,
        explanation: String,
      },
    ],
    testcases: [
      {
        input: { type: String, required: true },
        output: { type: String, required: true },
        hidden: { type: Boolean, default: false },
        points: { type: Number, default: 10 },
      },
    ],
    score: { type: Number, required: true, default: 100 },
    difficulty: {
      type: String,
      enum: ["EASY", "MEDIUM", "HARD"],
      default: "MEDIUM",
    },
    category: {
      type: String,
      enum: ["GENERAL", "DSA", "ALGORITHMS", "DATABASE", "SYSTEM_DESIGN"],
      default: "GENERAL",
    },
    timeLimit: { type: Number, default: 2 },
    memoryLimit: { type: Number, default: 256 },
    tags: [{ type: String }],
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],
    order: { type: Number, default: 0 },
    metrics: {
      attempted: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      wrongAnswer: { type: Number, default: 0 },
      tle: { type: Number, default: 0 },
      runtimeError: { type: Number, default: 0 },
    },
    submissionCount: { type: Number, default: 0 },
    acceptedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

codingProblemSchema.index({ contestId: 1, order: 1 });
codingProblemSchema.index({ isLibrary: 1, category: 1 });
codingProblemSchema.index({ isLibrary: 1, difficulty: 1 });
codingProblemSchema.index({ tags: 1 });

// Virtual for acceptance rate
codingProblemSchema.virtual("acceptanceRate").get(function () {
  const total = this.metrics?.attempted || this.submissionCount || 0;
  const accepted = this.metrics?.accepted || this.acceptedCount || 0;
  if (total === 0) return "0";
  return ((accepted / total) * 100).toFixed(2);
});

const CodingProblem: Model<ICodingProblem> =
  mongoose.models.CodingProblem ||
  mongoose.model<ICodingProblem>("CodingProblem", codingProblemSchema);

export default CodingProblem;
