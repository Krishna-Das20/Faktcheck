import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/contests/admin — Admin/Organiser contest management with stats
export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const query: Record<string, unknown> = {};
    if (user.role === "ORGANISER") {
      query.createdBy = user._id;
    }

    const contests = await Contest.find(query)
      .populate("createdBy", "name email")
      .populate("roomId", "name shortCode")
      .sort({ createdAt: -1 })
      .lean();

    // Compute stats
    const now = new Date();
    const totalContests = contests.length;
    const liveContests = contests.filter(
      (c) => new Date(c.startTime) <= now && new Date(c.endTime) >= now
    ).length;
    const upcomingContests = contests.filter(
      (c) => new Date(c.startTime) > now
    ).length;
    const totalParticipants = contests.reduce(
      (sum, c) => sum + (c.participants?.length || 0),
      0
    );

    return successResponse({
      contests,
      stats: { totalContests, liveContests, upcomingContests, totalParticipants },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Get admin contests error:", error);
    return errorResponse("Server error", 500);
  }
}

