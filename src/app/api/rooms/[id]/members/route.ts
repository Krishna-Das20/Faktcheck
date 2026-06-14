import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import User from "@/lib/models/User";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/rooms/[id]/members — Add member (admin only)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const reqUser = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    if (reqUser.role !== "ADMIN") {
      return errorResponse("Only admin can add members directly", 403);
    }

    const { email, role } = await request.json(); // role: "organiser" or "participant"
    if (!email) return errorResponse("Email is required");

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    const user = await User.findOne({ email });
    if (!user) return errorResponse("User not found", 404);

    if (room.isMember(user._id)) {
      return errorResponse("User is already a member", 400);
    }

    if (role === "organiser") {
      if (user.role !== "ORGANISER" && user.role !== "ADMIN") {
        return errorResponse("User must have ORGANISER role to be added as co-organiser", 400);
      }
      room.coOrganisers.push(user._id as any);
    } else {
      room.participants.push(user._id as any);
    }

    await room.save();

    return successResponse({ message: `${user.name} added to the room` });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Add member error:", error);
    return errorResponse("Failed to add member", 500);
  }
}
