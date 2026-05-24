import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContestRegistration extends Document {
  contestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contestRegistrationSchema = new Schema<IContestRegistration>(
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
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique registration per user per contest
contestRegistrationSchema.index({ contestId: 1, userId: 1 }, { unique: true });

const ContestRegistration: Model<IContestRegistration> =
  mongoose.models.ContestRegistration ||
  mongoose.model<IContestRegistration>("ContestRegistration", contestRegistrationSchema);

export default ContestRegistration;
