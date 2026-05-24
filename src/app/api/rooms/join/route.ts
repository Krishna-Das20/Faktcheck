import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/rooms/join — join room by short code
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await connectDB();

    const { shortCode } = await request.json();
    if (!shortCode) return errorResponse("Room code is required");

    const room = await Room.findOne({ shortCode: shortCode.toUpperCase() });
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
