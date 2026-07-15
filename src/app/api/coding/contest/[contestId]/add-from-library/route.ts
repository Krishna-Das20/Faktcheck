import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// POST /api/coding/contest/[contestId]/add-from-library — add library problems to a contest
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();

    // Only the contest owner (or a room co-organiser / admin) may add problems
    const contest = await requireContestOwner(user, contestId);

    const { problemIds } = await request.json();
    if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
      return errorResponse("problemIds array is required", 400);
    }

    const lastLink = await ContestCodingProblem.findOne({ contestId }).sort({ order: -1 });
    let currentOrder = lastLink ? lastLink.order + 1 : 1;

    const added: any[] = [];
    for (const problemId of problemIds) {
      const filter: any = { _id: problemId, isLibrary: true };
      if (user.role === "ORGANISER") {
        filter.$or = [{ isPublic: true }, { createdBy: user._id }];
      }
      const problem = await CodingProblem.findOne(filter);
      if (!problem) continue;

      const existing = await ContestCodingProblem.findOne({ contestId, problemId });
      if (existing) continue;

      const link = await ContestCodingProblem.create({
        contestId,
        problemId,
        score: problem.score,
        order: currentOrder++,
      });
      added.push(link);
    }

    // Keep the contest's coding totalMarks in sync
    if (added.length > 0) {
      const addedScore = added.reduce((sum, link) => sum + (link.score || 0), 0);
      contest.sections.coding.totalMarks =
        (contest.sections.coding.totalMarks || 0) + addedScore;
      await contest.save();
    }

    return successResponse({
      message: `${added.length} problem(s) added to contest`,
      added,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only add problems to your own contests", 403);
    console.error("Add library problems error:", error);
    return errorResponse("Server error", 500);
  }
}
