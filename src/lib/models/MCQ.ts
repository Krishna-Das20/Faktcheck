import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMCQOption {
  text: string;
  isCorrect: boolean;
  imageUrl?: string | null;
}

export interface IMCQ extends Document {
  contestId: mongoose.Types.ObjectId | null;
  isLibrary: boolean;
  isPublic: boolean;
  createdBy: mongoose.Types.ObjectId | null;
  question: string;
  options: IMCQOption[];
  correctAnswers: number[];
  marks: number;
  negativeMarks: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category: "GENERAL" | "APTITUDE" | "TECHNICAL" | "REASONING" | "ENTREPRENEURSHIP";
  explanation: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  order: number;
  metrics: {
    attempted: number;
    correct: number;
    wrong: number;
  };
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const mcqSchema = new Schema<IMCQ>(
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
    question: {
      type: String,
      required: [true, "Question is required"],
      trim: true,
    },
    options: [
      {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
        imageUrl: { type: String, default: null },
      },
    ],
    correctAnswers: [{ type: Number }],
    marks: { type: Number, required: true, default: 1 },
    negativeMarks: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ["EASY", "MEDIUM", "HARD"],
      default: "MEDIUM",
    },
    category: {
      type: String,
      enum: ["GENERAL", "APTITUDE", "TECHNICAL", "REASONING", "ENTREPRENEURSHIP"],
      default: "GENERAL",
    },
    explanation: { type: String, default: null },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null },
    order: { type: Number, default: 0 },
    metrics: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
    },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

mcqSchema.index({ contestId: 1, order: 1 });
mcqSchema.index({ isLibrary: 1, category: 1 });
mcqSchema.index({ tags: 1 });

const MCQ: Model<IMCQ> =
  mongoose.models.MCQ || mongoose.model<IMCQ>("MCQ", mcqSchema);

export default MCQ;
