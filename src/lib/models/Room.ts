import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export interface IPendingInvite {
  email: string;
  token: string;
  invitedBy: mongoose.Types.ObjectId;
  expiresAt: Date;
}

export interface IRoom extends Document {
  name: string;
  description?: string;
  shortCode: string;
  owner: mongoose.Types.ObjectId;
  coOrganisers: mongoose.Types.ObjectId[];
  participants: mongoose.Types.ObjectId[];
  pendingInvites: IPendingInvite[];
  isActive: boolean;
  memberCount: number; // virtual
  isMember(userId: string | mongoose.Types.ObjectId): boolean;
  isOwner(userId: string | mongoose.Types.ObjectId): boolean;
  isCoOrganiser(userId: string | mongoose.Types.ObjectId): boolean;
  isOrganiser(userId: string | mongoose.Types.ObjectId): boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [100, "Room name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    shortCode: {
      type: String,
      unique: true,
      uppercase: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coOrganisers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pendingInvites: [
      {
        email: { type: String, required: true },
        token: { type: String, required: true },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
        expiresAt: { type: Date, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Generate unique short code before saving
roomSchema.pre("save", async function () {
  if (!this.shortCode) {
    let code: string;
    let isUnique = false;

    while (!isUnique) {
      code = crypto.randomBytes(3).toString("hex").toUpperCase();
      const existingRoom = await mongoose.model("Room").findOne({ shortCode: code });
      if (!existingRoom) {
        isUnique = true;
        this.shortCode = code;
      }
    }
  }
});

// Virtual for total member count
roomSchema.virtual("memberCount").get(function () {
  return 1 + (this.coOrganisers?.length || 0) + (this.participants?.length || 0);
});

// Check if user is a member of the room
roomSchema.methods.isMember = function (userId: string | mongoose.Types.ObjectId): boolean {
  const userIdStr = userId.toString();
  const ownerId = (this.owner as any)?._id
    ? (this.owner as any)._id.toString()
    : this.owner?.toString();
  return (
    ownerId === userIdStr ||
    this.coOrganisers.some((co: any) => {
      const coId = co?._id ? co._id.toString() : co?.toString();
      return coId === userIdStr;
    }) ||
    this.participants.some((p: any) => {
      const pId = p?._id ? p._id.toString() : p?.toString();
      return pId === userIdStr;
    })
  );
};

// Check if user is the owner
roomSchema.methods.isOwner = function (userId: string | mongoose.Types.ObjectId): boolean {
  const userIdStr = userId.toString();
  const ownerId = (this.owner as any)?._id
    ? (this.owner as any)._id.toString()
    : this.owner?.toString();
  return ownerId === userIdStr;
};

// Check if user is a co-organiser
roomSchema.methods.isCoOrganiser = function (userId: string | mongoose.Types.ObjectId): boolean {
  const userIdStr = userId.toString();
  return this.coOrganisers.some((co: any) => {
    const coId = co?._id ? co._id.toString() : co?.toString();
    return coId === userIdStr;
  });
};

// Check if user is an organiser (owner or co-organiser)
roomSchema.methods.isOrganiser = function (userId: string | mongoose.Types.ObjectId): boolean {
  return this.isOwner(userId) || this.isCoOrganiser(userId);
};

roomSchema.index({ owner: 1 });
roomSchema.index({ coOrganisers: 1 });
roomSchema.index({ participants: 1 });
roomSchema.index({ shortCode: 1 });

const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>("Room", roomSchema);

export default Room;
