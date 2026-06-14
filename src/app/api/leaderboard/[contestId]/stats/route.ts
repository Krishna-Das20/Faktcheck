import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import Contest from "@/lib/models/Contest";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/leaderboard/[contestId]/stats — Contest statistics (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ);
    if (limited) return limited;

    const { contestId } = await params;
    await connectDB();

    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse("Contest not found", 404);

    const totalParticipants = contest.participants?.length || 0;
    const submitted = await Result.countDocuments({
      contestId,
      status: { $in: ["SUBMITTED", "EVALUATED"] },
    });

    const avgResult = await Result.aggregate([
      {
        $match: {
          contestId: contest._id,
          status: { $in: ["SUBMITTED", "EVALUATED"] },
        },
      },
      { $group: { _id: null, avgScore: { $avg: "$totalScore" } } },
    ]);

    return successResponse({
      stats: {
        totalParticipants,
        submitted,
        averageScore: avgResult[0]?.avgScore || 0,
        contestTitle: contest.title,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return errorResponse("Server error fetching stats", 500);
  }
}
