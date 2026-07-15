import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Contest from "@/lib/models/Contest";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

type Params = { params: Promise<{ contestId: string; mcqId: string }> };

// DELETE /api/mcqs/contest/[contestId]/remove/[mcqId]
// Unlinks a library MCQ from a contest (keeps it in the library)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { contestId, mcqId } = await params;
    await connectDB();

    // Only the contest owner (or a room co-organiser / admin) may remove MCQs
    await requireContestOwner(user, contestId);

    const contestMCQ = await ContestMCQ.findOneAndDelete({ contestId, mcqId });

    if (!contestMCQ) {
      return errorResponse("MCQ not found in contest", 404);
    }

    // Keep the contest's MCQ totalMarks in sync
    const contest = await Contest.findById(contestId);
    if (contest) {
      contest.sections.mcq.totalMarks = Math.max(
        0,
        (contest.sections.mcq.totalMarks || 0) - (contestMCQ.marks || 0)
      );
      await contest.save();
    }

    return successResponse({ message: "MCQ removed from contest" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only remove MCQs from your own contests", 403);
    console.error("Remove MCQ from contest error:", error);
    return errorResponse("Server error removing MCQ", 500);
  }
}
