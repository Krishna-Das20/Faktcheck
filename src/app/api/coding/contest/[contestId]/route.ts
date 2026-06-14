import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Contest from "@/lib/models/Contest";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/coding/contest/[contestId] — get problems for a contest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse("Contest not found", 404);

    // Access check: Admin, creator (organiser), or registered participant
    const isCreator =
      contest.createdBy?.toString() === user._id.toString();
    const isParticipant = contest.participants?.some(
      (p: any) => p.toString() === user._id.toString()
    );
    const isAdminOrCreator =
      user.role === "ADMIN" ||
      (user.role === "ORGANISER" && isCreator);

    if (!isAdminOrCreator && !isParticipant) {
      return errorResponse("You are not registered for this contest", 403);
    }

    // Admin/creator gets testcases; participants don't
    const selectFields = isAdminOrCreator ? "" : "-testcases";

    // Get contest-specific problems (direct)
    const directProblems = await CodingProblem.find({ contestId })
      .sort({ order: 1 })
      .select(selectFields);

    // Get library problems linked via ContestCodingProblem junction
    const contestProblemLinks = await ContestCodingProblem.find({ contestId })
      .populate({
        path: "problemId",
        select: selectFields,
      })
      .sort({ order: 1 });

    const libraryProblems = contestProblemLinks
      .filter((link: any) => link.problemId !== null)
      .map((link: any) => ({
        ...link.problemId.toObject(),
        _id: link.problemId._id,
        score: link.score || link.problemId.score,
        order: link.order,
        contestProblemId: link._id,
      }));

    // Combine and sort by order
    const allProblems = [...directProblems, ...libraryProblems].sort(
      (a: any, b: any) => (a.order || 0) - (b.order || 0)
    );

    return successResponse({
      count: allProblems.length,
      problems: allProblems,
      contest: {
        _id: contest._id,
        title: contest.title,
        duration: contest.duration,
        sections: contest.sections,
        startTime: contest.startTime,
        endTime: contest.endTime,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get contest problems error:", error);
    return errorResponse("Server error fetching coding problems", 500);
  }
}
