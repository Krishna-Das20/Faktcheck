import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAttachment {
  fileName: string;
  fileUrl: string;
  fileType: "image" | "document" | "other";
  publicId: string;
}

export interface IAnnouncement extends Document {
  roomId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  attachments: IAttachment[];
  createdBy: mongoose.Types.ObjectId;
  isPinned: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
      maxlength: [5000, "Content cannot exceed 5000 characters"],
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        publicId: String,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPinned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

announcementSchema.index({ roomId: 1, createdAt: -1 });
announcementSchema.index({ roomId: 1, isPinned: -1, createdAt: -1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>("Announcement", announcementSchema);

export default Announcement;
