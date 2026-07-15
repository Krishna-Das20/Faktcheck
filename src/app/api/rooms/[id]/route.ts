import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import Contest from "@/lib/models/Contest";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// GET /api/rooms/[id] — Room detail with contests + role flags
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    // Resolve by _id or shortCode
    const isObjectId = /^[a-f\d]{24}$/i.test(id);
    const room = isObjectId
      ? await Room.findById(id)
          .populate("owner", "name email avatar")
          .populate("coOrganisers", "name email avatar")
          .populate("participants", "name email avatar")
      : await Room.findOne({ shortCode: id.toUpperCase() })
          .populate("owner", "name email avatar")
          .populate("coOrganisers", "name email avatar")
          .populate("participants", "name email avatar");

    if (!room) return errorResponse("Room not found", 404);

    // Check access — Admin or room member
    if (user.role !== "ADMIN" && !room.isMember(user._id)) {
      return errorResponse("You are not a member of this room", 403);
    }

    // Get contests in this room
    const contests = await Contest.find({ roomId: room._id })
      .select("title description startTime endTime status sections createdBy")
      .populate("createdBy", "name email")
      .sort({ startTime: -1 })
      .lean();

    const ownerId = (room.owner as any)?._id?.toString() || room.owner?.toString();

    return successResponse({
      room,
      contests,
      isOwner: ownerId === user._id?.toString(),
      isOrganiser: room.isOrganiser(user._id),
      isAdmin: user.role === "ADMIN",
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get room error:", error);
    return errorResponse("Server error", 500);
  }
}

// PUT /api/rooms/[id] — Update room (owner or admin)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);

    if (!room.isOwner(user._id) && user.role !== "ADMIN") {
      return errorResponse("Only room owner or admin can update", 403);
    }

    const { name, description } = await request.json();
    if (name) room.name = name;
    if (description !== undefined) room.description = description;
    await room.save();

    return successResponse({ message: "Room updated", room });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Update room error:", error);
    return errorResponse("Server error", 500);
  }
}

// DELETE /api/rooms/[id] — Soft delete (owner or admin)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const room = await Room.findById(id);
    if (!room) return errorResponse("Room not found", 404);
    if (!room.isOwner(user._id) && user.role !== "ADMIN") {
      return errorResponse("Only room owner or admin can delete", 403);
    }

    // Soft delete
    room.isActive = false;
    await room.save();

    return successResponse({ message: "Room deleted successfully" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Delete room error:", error);
    return errorResponse("Server error", 500);
  }
}
