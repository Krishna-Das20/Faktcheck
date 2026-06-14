import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Contest from "@/lib/models/Contest";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/mcqs/contest/[contestId] — get MCQs for a contest
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

    // Get contest-specific MCQs (direct)
    const selectFields = isAdminOrCreator
      ? ""
      : "-correctAnswers -explanation";
    const directMCQs = await MCQ.find({ contestId })
      .sort({ order: 1 })
      .select(selectFields);

    // Get library MCQs linked via ContestMCQ junction
    const contestMCQLinks = await ContestMCQ.find({ contestId })
      .populate({
        path: "mcqId",
        select: selectFields,
      })
      .sort({ order: 1 });

    const libraryMCQs = contestMCQLinks
      .filter((link: any) => link.mcqId !== null)
      .map((link: any) => ({
        ...link.mcqId.toObject(),
        _id: link.mcqId._id,
        marks: link.marks || link.mcqId.marks,
        order: link.order,
        contestMCQId: link._id,
      }));

    // Combine and sort
    let allMCQs = [...directMCQs, ...libraryMCQs].sort(
      (a: any, b: any) => (a.order || 0) - (b.order || 0)
    );

    // For non-admin: strip isCorrect from options, add questionType
    if (!isAdminOrCreator) {
      allMCQs = allMCQs.map((mcq: any) => {
        const obj = mcq.toObject ? mcq.toObject() : { ...mcq };
        const correctCount = obj.options.filter(
          (o: any) => o.isCorrect
        ).length;
        obj.questionType = correctCount > 1 ? "MULTIPLE" : "SINGLE";
        obj.options = obj.options.map(({ isCorrect, ...rest }: any) => rest);
        return obj;
      });
    }

    return successResponse({
      count: allMCQs.length,
      mcqs: allMCQs,
      contest: {
        _id: contest._id,
        title: contest.title,
        duration: contest.duration,
        sections: contest.sections,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get contest MCQs error:", error);
    return errorResponse("Server error fetching MCQs", 500);
  }
}
