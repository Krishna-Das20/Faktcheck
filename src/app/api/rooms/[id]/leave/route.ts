import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/leave — Leave room (participants/co-organisers)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    // Owner cannot leave
    if (room.isOwner(user._id)) {
      return errorResponse("Room owner cannot leave. Transfer ownership or delete the room.", 400);
    }

    // Remove from both arrays
    room.coOrganisers = room.coOrganisers.filter(
      (co: any) => co.toString() !== user._id?.toString()
    );
    room.participants = room.participants.filter(
      (p: any) => p.toString() !== user._id?.toString()
    );

    await room.save();

    return successResponse({ message: "Left the room successfully" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Leave room error:", error);
    return errorResponse("Failed to leave room", 500);
  }
}
