import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Announcement from "@/lib/models/Announcement";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string; announcementId: string }> };

// PUT /api/rooms/[id]/announcements/[announcementId]/pin
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
      return errorResponse("Only room organisers can pin announcements", 403);
    }

    const announcement = await Announcement.findOne({ _id: announcementId, roomId: id });
    if (!announcement) return errorResponse("Announcement not found", 404);

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    return successResponse({
      message: announcement.isPinned ? "Announcement pinned" : "Announcement unpinned",
      isPinned: announcement.isPinned,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Toggle pin announcement error:", error);
    return errorResponse("Server error", 500);
  }
}
