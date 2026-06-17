import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Contest from "@/lib/models/Contest";

type Params = { params: Promise<{ contestId: string; problemId: string }> };

// DELETE /api/coding/contest/[contestId]/remove/[problemId]
// Unlinks a library problem from a contest (keeps it in library)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { contestId, problemId } = await params;
    await connectDB();

    const contestProblem = await ContestCodingProblem.findOneAndDelete({
      contestId,
      problemId,
    });

    if (!contestProblem) {
      return errorResponse("Problem not found in contest", 404);
    }

    // Update contest total marks
    const contest = await Contest.findById(contestId);
    if (contest) {
      contest.sections.coding.totalMarks -= contestProblem.score || 0;
      await contest.save();
    }

    return successResponse({ message: "Problem removed from contest" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Remove problem from contest error:", error);
    return errorResponse("Server error removing problem", 500);
  }
}
