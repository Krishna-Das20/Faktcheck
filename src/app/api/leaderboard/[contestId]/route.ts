import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import { getAuthUser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/leaderboard/[contestId]
export async function GET(request: NextRequest, { params }: { params: Promise<{ contestId: string }> }) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ);
    if (limited) return limited;

    const { contestId } = await params;
    await connectDB();

    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse("Contest not found", 404);

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Get current user for auth and rank checking
    const user = await getAuthUser(request);

    // Determine if this user gets the detailed view
    const isDetailedView = user && (
      user.role === "ADMIN" ||
      (user.role === "ORGANISER" && contest.createdBy?.toString() === user._id?.toString())
    );

    // Get results sorted by score (desc) and time (asc)
    const results = await Result.find({
      contestId,
      status: { $in: ["SUBMITTED", "EVALUATED"] },
    })
      .sort({ totalScore: -1, timeTaken: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email college avatar");

    const total = await Result.countDocuments({
      contestId,
      status: { $in: ["SUBMITTED", "EVALUATED"] },
    });

    // For detailed view, bulk-fetch all ContestProgress records
    let progressMap: Record<string, any> = {};
    if (isDetailedView) {
      const userIds = results.map((r) => (r.userId as any)?._id || r.userId);
      const progressRecords = await ContestProgress.find({
        contestId,
        userId: { $in: userIds },
      });
      progressRecords.forEach((p) => {
        progressMap[p.userId.toString()] = p;
      });
    }

    // Build leaderboard with tied-rank logic (matching KK)
    let currentRank = skip + 1;
    const leaderboard = results.map((result, index) => {
      const userId = (result.userId as any)?._id || result.userId;

      // Tied-rank: same totalScore AND timeTaken = same rank
      if (index > 0) {
        const prev = results[index - 1];
        if (
          result.totalScore === prev.totalScore &&
          result.timeTaken === prev.timeTaken
        ) {
          // Same rank as previous
        } else {
          currentRank = skip + index + 1;
        }
      }

      const base: any = {
        rank: currentRank,
        userId: userId?.toString(),
        user: {
          _id: userId?.toString(),
          name: (result.userId as any)?.name,
          college: (result.userId as any)?.college,
          avatar: (result.userId as any)?.avatar,
        },
        mcqScore: result.mcqScore,
        codingScore: result.codingScore,
        formsScore: result.formsScore,
        totalScore: result.totalScore,
        timeTaken: result.timeTaken,
        status: result.status,
      };

      // Add detailed info for admin/creator
      if (isDetailedView) {
        base.user.email = (result.userId as any)?.email;
        const prog = progressMap[userId?.toString()];
        if (prog) {
          base.details = {
            warningCount: prog.warningCount || 0,
            terminationReason: prog.terminationReason,
            progressStatus: prog.status,
            mcqSectionTime: prog.mcqProgress?.sectionTimeSpent || 0,
            codingSectionTime: prog.codingProgress?.sectionTimeSpent || 0,
            questionTimes: prog.mcqProgress?.questionTimes || [],
            problemTimes: prog.codingProgress?.problemTimes || [],
            categoryTimes: prog.mcqProgress?.categoryTimes || [],
            startedAt: prog.startedAt,
            submittedAt: prog.submittedAt,
          };
        }
      }

      // Persist rank in DB (like KK does)
      Result.findByIdAndUpdate(result._id, { rank: currentRank }).catch(() => {});

      return base;
    });

    // Get current user's rank if authenticated
    let userRank = null;
    if (user) {
      const userResult = await Result.findOne({ contestId, userId: user._id });
      if (userResult) {
        const betterCount = await Result.countDocuments({
          contestId,
          status: { $in: ["SUBMITTED", "EVALUATED"] },
          $or: [
            { totalScore: { $gt: userResult.totalScore } },
            { totalScore: userResult.totalScore, timeTaken: { $lt: userResult.timeTaken } },
          ],
        });
        userRank = betterCount + 1;
      }
    }

    return successResponse({
      contest: { title: contest.title, status: contest.status },
      leaderboard,
      userRank,
      isDetailedView: !!isDetailedView,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return errorResponse("Server error", 500);
  }
}
