import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// POST /api/mcqs/contest/[contestId]/add-from-library — add library MCQs to a contest
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

    // Only the contest owner (or a room co-organiser / admin) may add MCQs
    const contest = await requireContestOwner(user, contestId);

    const { mcqIds } = await request.json();
    if (!mcqIds || !Array.isArray(mcqIds) || mcqIds.length === 0) {
      return errorResponse("mcqIds array is required", 400);
    }

    // Get current max order
    const lastLink = await ContestMCQ.findOne({ contestId }).sort({ order: -1 });
    let currentOrder = lastLink ? lastLink.order + 1 : 1;

    const added: any[] = [];
    for (const mcqId of mcqIds) {
      // Verify the MCQ exists and user can see it
      const filter: any = { _id: mcqId, isLibrary: true };
      if (user.role === "ORGANISER") {
        filter.$or = [{ isPublic: true }, { createdBy: user._id }];
      }
      const mcq = await MCQ.findOne(filter);
      if (!mcq) continue;

      // Skip if already linked
      const existing = await ContestMCQ.findOne({ contestId, mcqId });
      if (existing) continue;

      const link = await ContestMCQ.create({
        contestId,
        mcqId,
        marks: mcq.marks,
        order: currentOrder++,
      });
      added.push(link);
    }

    // Keep the contest's MCQ totalMarks in sync
    if (added.length > 0) {
      const addedMarks = added.reduce((sum, link) => sum + (link.marks || 0), 0);
      contest.sections.mcq.totalMarks =
        (contest.sections.mcq.totalMarks || 0) + addedMarks;
      await contest.save();
    }

    return successResponse({
      message: `${added.length} MCQ(s) added to contest`,
      added,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only add MCQs to your own contests", 403);
    console.error("Add library MCQs error:", error);
    return errorResponse("Server error", 500);
  }
}
