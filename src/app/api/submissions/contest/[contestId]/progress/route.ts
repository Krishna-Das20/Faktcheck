import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/submissions/contest/[contestId]/progress — aggregated coding progress
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

    // Get total problem count
    const [problems, linkedProblems] = await Promise.all([
      CodingProblem.find({ contestId }).select("_id"),
      ContestCodingProblem.find({ contestId }).select("problemId"),
    ]);
    const total = new Set([
      ...problems.map((problem) => problem._id.toString()),
      ...linkedProblems.map((link) => link.problemId.toString()),
    ]).size;

    // Get distinct problem IDs with at least one ACCEPTED submission
    const acceptedProblemIds = await Submission.distinct("problemId", {
      contestId,
      userId: user._id,
      verdict: "ACCEPTED",
    });

    return successResponse({ accepted: acceptedProblemIds.length, total });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get coding progress error:", error);
    return errorResponse("Server error fetching coding progress", 500);
  }
}
