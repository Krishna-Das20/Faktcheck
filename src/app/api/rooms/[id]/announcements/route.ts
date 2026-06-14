import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Announcement from "@/lib/models/Announcement";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// GET /api/rooms/[id]/announcements
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room || !room.isActive) return errorResponse("Room not found", 404);
    if (user.role !== "ADMIN" && !room.isMember(user._id)) {
      return errorResponse("You are not a member of this room", 403);
    }

    const announcements = await Announcement.find({ roomId: id, isActive: true })
      .sort({ isPinned: -1, createdAt: -1 })
      .populate("createdBy", "name email avatar");

    return successResponse({ count: announcements.length, announcements });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get announcements error:", error);
    return errorResponse("Server error", 500);
  }
}

// POST /api/rooms/[id]/announcements
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);
    if (user.role !== "ADMIN" && !room.isOrganiser(user._id)) {
      return errorResponse("Only room organisers can post announcements", 403);
    }

    const body = await request.json();
    const announcement = await Announcement.create({
      ...body,
      roomId: id,
      createdBy: user._id,
    });

    return successResponse({ message: "Announcement posted", announcement }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Create announcement error:", error);
    return errorResponse("Server error", 500);
  }
}
