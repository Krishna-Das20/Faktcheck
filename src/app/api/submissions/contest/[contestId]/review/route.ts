import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/submissions/contest/[contestId]/review — coding review per problem
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

    // Get all problems for this contest
    const directProblems = await CodingProblem.find({ contestId })
      .select("title difficulty score order")
      .sort({ order: 1 });
    const problemLinks = await ContestCodingProblem.find({ contestId })
      .populate("problemId", "title difficulty score order")
      .sort({ order: 1 });
    const problems: any[] = [
      ...directProblems,
      ...problemLinks
        .filter((link: any) => link.problemId)
        .map((link: any) => ({
          ...link.problemId.toObject(),
          score: link.score ?? link.problemId.score,
          order: link.order,
        })),
    ].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Get all user submissions for this contest
    const submissions = await Submission.find({
      contestId,
      userId: user._id,
    })
      .select("problemId language verdict score submittedAt")
      .sort({ submittedAt: -1 });

    // Group submissions by problem
    const review = problems.map((problem) => {
      const problemSubmissions = submissions.filter(
        (s) => s.problemId.toString() === problem._id.toString()
      );
      const bestSubmission =
        problemSubmissions.find((s) => s.verdict === "ACCEPTED") ||
        problemSubmissions[0] ||
        null;

      return {
        problem: {
          _id: problem._id,
          title: problem.title,
          difficulty: problem.difficulty,
          marks: problem.score,
        },
        submissionCount: problemSubmissions.length,
        bestVerdict: bestSubmission?.verdict || "NOT_ATTEMPTED",
        bestScore: bestSubmission?.score || 0,
        language: bestSubmission?.language || null,
        lastSubmittedAt: problemSubmissions[0]?.submittedAt || null,
      };
    });

    return successResponse({ review });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get coding review error:", error);
    return errorResponse("Server error fetching coding review", 500);
  }
}
