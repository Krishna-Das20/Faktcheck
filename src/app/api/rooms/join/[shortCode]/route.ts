import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ shortCode: string }> };

// GET /api/rooms/join/[shortCode] — Join room by link (auto-join)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(request);
    const { shortCode } = await params;
    await connectDB();

    const room = await Room.findOne({
      shortCode: shortCode.toUpperCase(),
      isActive: { $ne: false },
    });

    if (!room) return errorResponse("Room not found", 404);

    // Already a member
    if (room.isMember(user._id)) {
      return successResponse({
        message: "You are already a member of this room",
        room,
        alreadyMember: true,
      });
    }

    // Add user as participant
    room.participants.push(user._id as any);
    await room.save();

    return successResponse({
      message: `Successfully joined ${room.name}`,
      room,
      alreadyMember: false,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Join room by link error:", error);
    return errorResponse("Failed to join room", 500);
  }
}
