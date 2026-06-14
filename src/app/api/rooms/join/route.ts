import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { joinRoomSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/rooms/join — join room by short code
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);

    const { data, error } = await validateBody(request, joinRoomSchema);
    if (error) return error;

    await connectDB();

    const room = await Room.findOne({ shortCode: data.shortCode.toUpperCase() });
    if (!room) return errorResponse("Room not found. Check the code.", 404);

    // Check if already a member/owner/co-organiser
    if (room.isMember(user._id)) {
      return errorResponse("You're already in this room");
    }

    // Add to participants
    room.participants.push(user._id as any);
    await room.save();

    return successResponse({ message: `Joined "${room.name}" successfully`, room });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Join room error:", error);
    return errorResponse("Server error", 500);
  }
}
