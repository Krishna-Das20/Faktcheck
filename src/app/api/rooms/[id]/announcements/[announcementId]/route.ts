import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Announcement from "@/lib/models/Announcement";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { deleteFromCloudinary } from "@/lib/cloudinary";

type Params = { params: Promise<{ id: string; announcementId: string }> };

// PUT /api/rooms/[id]/announcements/[announcementId]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id, announcementId } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    if (user.role !== "ADMIN" && !room.isOrganiser(user._id)) {
      return errorResponse("Only room organisers can update announcements", 403);
    }

    const announcement = await Announcement.findOne({ _id: announcementId, roomId: id });
    if (!announcement) return errorResponse("Announcement not found", 404);

    const body = await request.json();
    const { title, content, attachments, isPinned } = body;

    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;
    if (attachments !== undefined) announcement.attachments = attachments;
    if (isPinned !== undefined) announcement.isPinned = isPinned;

    await announcement.save();

    return successResponse({ message: "Announcement updated", announcement });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Update announcement error:", error);
    return errorResponse("Server error", 500);
  }
}

// DELETE /api/rooms/[id]/announcements/[announcementId]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id, announcementId } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    if (user.role !== "ADMIN" && !room.isOrganiser(user._id)) {
      return errorResponse("Only room organisers can delete announcements", 403);
    }

    const announcement = await Announcement.findOne({ _id: announcementId, roomId: id });
    if (!announcement) return errorResponse("Announcement not found", 404);

    await Promise.all(
      announcement.attachments.map((attachment) =>
        deleteFromCloudinary(attachment.publicId, attachment.fileType === "image" ? "image" : "raw")
      )
    );
    announcement.isActive = false;
    await announcement.save();

    return successResponse({ message: "Announcement deleted" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Delete announcement error:", error);
    return errorResponse("Server error", 500);
  }
}
