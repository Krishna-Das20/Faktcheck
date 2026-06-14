import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/mcqs/contest/[contestId]/review — Get MCQ review data (post-submission)
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

    // Get user's result
    const result = await Result.findOne({
      userId: user._id,
      contestId,
    });

    if (!result) {
      return successResponse({ review: [] });
    }

    // Build answer map
    const answeredMap = new Map<string, any>();
    if (result.mcqAnswers) {
      for (const answer of result.mcqAnswers) {
        answeredMap.set(answer.questionId?.toString(), answer);
      }
    }

    // Get all MCQs for this contest (direct + junction)
    const directMcqs = await MCQ.find({ contestId }).lean();
    const junctionEntries = await ContestMCQ.find({ contestId })
      .populate({
        path: "mcqId",
        select: "question options marks negativeMarks category difficulty imageUrl explanation questionType",
      })
      .sort({ order: 1 })
      .lean();

    // Merge and deduplicate
    const mcqMap = new Map<string, any>();
    for (const m of directMcqs) {
      mcqMap.set((m as any)._id.toString(), m);
    }
    for (const je of junctionEntries) {
      if ((je as any).mcqId) {
        const mcq = (je as any).mcqId;
        if (!mcqMap.has(mcq._id.toString())) {
          mcqMap.set(mcq._id.toString(), {
            ...mcq,
            marks: (je as any).marks ?? mcq.marks,
            negativeMarks: (je as any).negativeMarks ?? mcq.negativeMarks,
          });
        }
      }
    }

    // Build review data
    const review = Array.from(mcqMap.values()).map((mcq) => {
      const answer = answeredMap.get(mcq._id.toString());
      const correctAnswers = mcq.options
        .map((opt: any, index: number) => (opt.isCorrect ? index : -1))
        .filter((i: number) => i !== -1);

      return {
        _id: mcq._id,
        question: mcq.question,
        questionType: mcq.questionType || "SINGLE",
        options: mcq.options.map((opt: any) => opt.text || opt),
        imageUrl: mcq.imageUrl || null,
        category: mcq.category,
        difficulty: mcq.difficulty,
        marks: mcq.marks,
        explanation: mcq.explanation || null,
        correctAnswers,
        userAnswer: answer?.selectedOptions || [],
        isCorrect: answer?.isCorrect || false,
        marksAwarded: answer?.marksAwarded || 0,
      };
    });

    return successResponse({ review });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("MCQ review error:", error);
    return errorResponse("Server error fetching MCQ review", 500);
  }
}
