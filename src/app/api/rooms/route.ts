import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Room from "@/lib/models/Room";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/rooms — list rooms with RBAC filtering
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await connectDB();

    let filter: any;

    if (user.role === "ADMIN") {
      // Admin sees all active rooms
      filter = { isActive: { $ne: false } };
    } else if (user.role === "ORGANISER") {
      // Organiser sees owned + co-organised + joined rooms
      filter = {
        isActive: { $ne: false },
        $or: [
          { owner: user._id },
          { coOrganisers: user._id },
          { participants: user._id },
        ],
      };
    } else {
      // Participant sees only joined rooms
      filter = {
        isActive: { $ne: false },
        participants: user._id,
      };
    }

    const rooms = await Room.find(filter)
      .sort({ createdAt: -1 })
      .populate("owner", "name email avatar")
      .populate("coOrganisers", "name email avatar");

    // Add counts
    const roomsWithCounts = rooms.map((room) => ({
      ...room.toObject(),
      participantCount: room.participants?.length || 0,
      coOrganiserCount: room.coOrganisers?.length || 0,
    }));

    return successResponse({ count: roomsWithCounts.length, rooms: roomsWithCounts });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get rooms error:", error);
    return errorResponse("Server error", 500);
  }
}

// POST /api/rooms — create room
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const body = await request.json();
    const room = await Room.create({
      ...body,
      owner: user._id,
    });

    await room.populate("owner", "name email avatar");

    return successResponse({ message: "Room created successfully", room }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Create room error:", error);
    return errorResponse("Server error creating room", 500);
  }
}
