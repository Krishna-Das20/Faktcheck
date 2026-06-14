import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import Room from "@/lib/models/Room";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { createContestSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/contests — List all public contests
export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ);
    if (limited) return limited;

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
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);

    const { data, error } = await validateBody(request, createContestSchema);
    if (error) return error;

    await connectDB();

    let verificationStatus = "PENDING";
    if (user.role === "ADMIN") {
      verificationStatus = "APPROVED";
    } else if (data.roomId) {
      const room = await Room.findById(data.roomId);
      if (!room) return errorResponse("Room not found", 404);
      if (!room.isOwner(user._id) && !room.isCoOrganiser(user._id)) {
        return errorResponse("Not authorized to create contests in this room", 403);
      }
      verificationStatus = "APPROVED";
    }

    // Auto-compute duration from start/end times if not provided
    const computedDuration = data.duration || Math.round(
      (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / 60000
    );

    const contest = await Contest.create({
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: computedDuration,
      sections: data.sections,
      rules: data.rules,
      prizes: data.prizes,
      maxParticipants: data.maxParticipants,
      banner: data.banner,
      isPublished: data.isPublished || false,
      createdBy: user._id,
      verificationStatus,
      roomId: data.roomId?.trim() || null,
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
