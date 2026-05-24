import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/coding/contest/[contestId]/add-from-library — add library problems to a contest
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();

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

    return successResponse({
      message: `${added.length} problem(s) added to contest`,
      added,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Add library problems error:", error);
    return errorResponse("Server error", 500);
  }
}
