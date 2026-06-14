import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string; userId: string }> };

// DELETE /api/rooms/[id]/members/[userId] — Remove member (owner or admin)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const reqUser = await requireAuth(request);
    const { id, userId } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    const isOwner = room.isOwner(reqUser._id);
    const isAdmin = reqUser.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return errorResponse("Only room owner or admin can remove members", 403);
    }

    // Cannot remove owner
    if (room.isOwner(userId)) {
      return errorResponse("Cannot remove the room owner", 400);
    }

    // Remove from both arrays
    room.coOrganisers = room.coOrganisers.filter(
      (co: any) => co.toString() !== userId
    );
    room.participants = room.participants.filter(
      (p: any) => p.toString() !== userId
    );

    await room.save();

    return successResponse({ message: "Member removed successfully" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Remove member error:", error);
    return errorResponse("Failed to remove member", 500);
  }
}
