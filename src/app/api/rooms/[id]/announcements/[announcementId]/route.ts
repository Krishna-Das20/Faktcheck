import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Announcement from "@/lib/models/Announcement";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; announcementId: string }> };

// PUT /api/rooms/[id]/announcements/[announcementId]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
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
    const { title, content } = body;

    if (title !== undefined) announcement.title = title;
    if (content !== undefined) announcement.content = content;

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
    const user = await requireAuth(request);
    const { id, announcementId } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    if (user.role !== "ADMIN" && !room.isOrganiser(user._id)) {
      return errorResponse("Only room organisers can delete announcements", 403);
    }

    const announcement = await Announcement.findOneAndDelete({ _id: announcementId, roomId: id });
    if (!announcement) return errorResponse("Announcement not found", 404);

    return successResponse({ message: "Announcement deleted" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Delete announcement error:", error);
    return errorResponse("Server error", 500);
  }
}
