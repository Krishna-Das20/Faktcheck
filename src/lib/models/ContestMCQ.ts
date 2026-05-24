import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContestMCQ extends Document {
  contestId: mongoose.Types.ObjectId;
  mcqId: mongoose.Types.ObjectId;
  marks: number | null;
  negativeMarks: number | null;
  order: number;
  contestMetrics: {
    attempted: number;
    correct: number;
    wrong: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const contestMCQSchema = new Schema<IContestMCQ>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    mcqId: {
      type: Schema.Types.ObjectId,
      ref: "MCQ",
      required: true,
    },
    marks: { type: Number, default: null },
    negativeMarks: { type: Number, default: null },
    order: { type: Number, default: 0 },
    contestMetrics: {
      attempted: { type: Number, default: 0 },
      correct: { type: Number, default: 0 },
      wrong: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

contestMCQSchema.index({ contestId: 1, mcqId: 1 }, { unique: true });
contestMCQSchema.index({ contestId: 1, order: 1 });

const ContestMCQ: Model<IContestMCQ> =
  mongoose.models.ContestMCQ || mongoose.model<IContestMCQ>("ContestMCQ", contestMCQSchema);

export default ContestMCQ;
