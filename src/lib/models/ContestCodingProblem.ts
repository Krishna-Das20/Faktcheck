import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContestCodingProblem extends Document {
  contestId: mongoose.Types.ObjectId;
  problemId: mongoose.Types.ObjectId;
  score: number | null;
  timeLimit: number | null;
  order: number;
  contestMetrics: {
    attempted: number;
    accepted: number;
    wrongAnswer: number;
    tle: number;
    runtimeError: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const contestCodingProblemSchema = new Schema<IContestCodingProblem>(
  {
    contestId: {
      type: Schema.Types.ObjectId,
      ref: "Contest",
      required: true,
    },
    problemId: {
      type: Schema.Types.ObjectId,
      ref: "CodingProblem",
      required: true,
    },
    score: { type: Number, default: null },
    timeLimit: { type: Number, default: null },
    order: { type: Number, default: 0 },
    contestMetrics: {
      attempted: { type: Number, default: 0 },
      accepted: { type: Number, default: 0 },
      wrongAnswer: { type: Number, default: 0 },
      tle: { type: Number, default: 0 },
      runtimeError: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

contestCodingProblemSchema.index({ contestId: 1, problemId: 1 }, { unique: true });
contestCodingProblemSchema.index({ contestId: 1, order: 1 });

const ContestCodingProblem: Model<IContestCodingProblem> =
  mongoose.models.ContestCodingProblem ||
  mongoose.model<IContestCodingProblem>("ContestCodingProblem", contestCodingProblemSchema);

export default ContestCodingProblem;
