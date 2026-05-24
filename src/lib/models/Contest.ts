import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContestSection {
  enabled: boolean;
  hasTimer?: boolean;
  duration?: number;
  totalMarks: number;
  proctored: boolean;
}

export interface IContest extends Document {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  sections: {
    mcq: IContestSection & { duration: number };
    coding: IContestSection & { duration: number };
    forms: Omit<IContestSection, "duration">;
  };
  rules: string[];
  prizes: string[];
  status: "UPCOMING" | "LIVE" | "ENDED";
  maxParticipants: number | null;
  participants: mongoose.Types.ObjectId[];
  isPublished: boolean;
  banner: string | null;
  createdBy: mongoose.Types.ObjectId;
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  roomId: mongoose.Types.ObjectId | null;
  totalMarks: number; // virtual
  createdAt: Date;
  updatedAt: Date;
}

const contestSchema = new Schema<IContest>(
  {
    title: {
      type: String,
      required: [true, "Contest title is required"],
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    duration: {
      type: Number, // in minutes
      required: [true, "Duration is required"],
    },
    sections: {
      mcq: {
        enabled: { type: Boolean, default: true },
        hasTimer: { type: Boolean, default: false },
        duration: { type: Number, default: 30 },
        totalMarks: { type: Number, default: 0 },
        proctored: { type: Boolean, default: true },
      },
      coding: {
        enabled: { type: Boolean, default: true },
        hasTimer: { type: Boolean, default: false },
        duration: { type: Number, default: 120 },
        totalMarks: { type: Number, default: 0 },
        proctored: { type: Boolean, default: true },
      },
      forms: {
        enabled: { type: Boolean, default: false },
        totalMarks: { type: Number, default: 0 },
        proctored: { type: Boolean, default: false },
      },
    },
    rules: [{ type: String }],
    prizes: [{ type: String }],
    status: {
      type: String,
      enum: ["UPCOMING", "LIVE", "ENDED"],
      default: "UPCOMING",
    },
    maxParticipants: {
      type: Number,
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
    banner: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
contestSchema.index({ status: 1, startTime: -1 });
contestSchema.index({ isPublished: 1 });

// Virtual for total marks - only count enabled sections
contestSchema.virtual("totalMarks").get(function () {
  let total = 0;
  if (this.sections.mcq?.enabled) {
    total += this.sections.mcq.totalMarks || 0;
  }
  if (this.sections.coding?.enabled) {
    total += this.sections.coding.totalMarks || 0;
  }
  if (this.sections.forms?.enabled) {
    total += this.sections.forms.totalMarks || 0;
  }
  return total;
});

const Contest: Model<IContest> =
  mongoose.models.Contest || mongoose.model<IContest>("Contest", contestSchema);

export default Contest;
