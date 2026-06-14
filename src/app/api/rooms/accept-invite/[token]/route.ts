import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

// POST /api/rooms/accept-invite/[token] — Accept co-organiser invite
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { token } = await params;
    await connectDB();

    // Find room with this pending invite token
    const room = await Room.findOne({ "pendingInvites.token": token });
    if (!room) return errorResponse("Invalid or expired invitation link", 404);

    // Find the specific invite
    const invite = room.pendingInvites.find((inv: any) => inv.token === token);
    if (!invite) return errorResponse("Invitation not found", 404);

    // Check expiry
    if (invite.expiresAt < new Date()) {
      room.pendingInvites = room.pendingInvites.filter((inv: any) => inv.token !== token);
      await room.save();
      return errorResponse("This invitation has expired. Please ask the room owner to send a new one.", 400);
    }

    // Verify logged-in user matches the invite email
    if (user.email !== invite.email) {
      return errorResponse("This invitation was sent to a different email address. Please log in with the correct account.", 403);
    }

    // Already a co-organiser
    if (room.isCoOrganiser(user._id)) {
      room.pendingInvites = room.pendingInvites.filter((inv: any) => inv.token !== token);
      await room.save();
      return successResponse({ message: "You are already a co-organiser of this room", roomId: room._id });
    }

    // If user is currently a participant, remove from participants
    room.participants = room.participants.filter(
      (p: any) => p.toString() !== user._id?.toString()
    );

    // Add as co-organiser
    room.coOrganisers.push(user._id as any);

    // Remove the used invite
    room.pendingInvites = room.pendingInvites.filter((inv: any) => inv.token !== token);

    await room.save();

    return successResponse({
      message: `You are now a co-organiser of "${room.name}"!`,
      roomId: room._id,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Accept co-organiser invite error:", error);
    return errorResponse("Failed to accept invitation", 500);
  }
}
