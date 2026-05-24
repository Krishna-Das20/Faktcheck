import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import Room from "@/lib/models/Room";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/contests — List all public contests
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const status = request.nextUrl.searchParams.get("status");

    const query: Record<string, unknown> = {
      isPublished: true,
      verificationStatus: "APPROVED",
      $or: [{ roomId: null }, { roomId: { $exists: false } }],
    };
    if (status) query.status = status;

    const contests = await Contest.find(query)
      .sort({ startTime: -1 })
      .populate("createdBy", "name email");

    return successResponse({ count: contests.length, contests });
  } catch (error) {
    console.error("Get contests error:", error);
    return errorResponse("Server error fetching contests", 500);
  }
}

// POST /api/contests — Create contest
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();
    const body = await request.json();
    const { roomId } = body;

    let verificationStatus = "PENDING";
    if (user.role === "ADMIN") {
      verificationStatus = "APPROVED";
    } else if (roomId) {
      const room = await Room.findById(roomId);
      if (!room) return errorResponse("Room not found", 404);
      if (!room.isOwner(user._id) && !room.isCoOrganiser(user._id)) {
        return errorResponse("Not authorized to create contests in this room", 403);
      }
      verificationStatus = "APPROVED";
    }

    const contest = await Contest.create({
      title: body.title,
      description: body.description,
      startTime: body.startTime,
      endTime: body.endTime,
      duration: body.duration,
      sections: body.sections,
      rules: body.rules,
      prizes: body.prizes,
      maxParticipants: body.maxParticipants,
      banner: body.banner,
      isPublished: body.isPublished || false,
      createdBy: user._id,
      verificationStatus,
      roomId: roomId?.trim() || null,
    });

    return successResponse(
      {
        message: user.role === "ADMIN" ? "Contest created successfully" : "Contest created and submitted for approval",
        contest,
      },
      201
    );
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Create contest error:", error);
    return errorResponse("Server error creating contest", 500);
  }
}
