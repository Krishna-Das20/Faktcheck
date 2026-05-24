import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/coding/contest/[contestId]/review — Get coding review data (post-submission)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    // Get all coding problems for this contest
    const directProblems = await CodingProblem.find({ contestId })
      .select("title category score difficulty order")
      .lean();
    const junctionEntries = await ContestCodingProblem.find({ contestId })
      .populate({
        path: "problemId",
        select: "title category score difficulty",
      })
      .sort({ order: 1 })
      .lean();

    // Merge
    const problemMap = new Map<string, any>();
    for (const p of directProblems) {
      problemMap.set((p as any)._id.toString(), p);
    }
    for (const je of junctionEntries) {
      if ((je as any).problemId) {
        const prob = (je as any).problemId;
        if (!problemMap.has(prob._id.toString())) {
          problemMap.set(prob._id.toString(), {
            ...prob,
            score: (je as any).score ?? prob.score,
            order: (je as any).order ?? 0,
          });
        }
      }
    }

    const allProblems = Array.from(problemMap.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    // Get result for coding submissions
    const result = await Result.findOne({
      userId: user._id,
      contestId,
    }).lean();

    const attemptedMap = new Map<string, any>();
    if ((result as any)?.codingSubmissions) {
      for (const cs of (result as any).codingSubmissions) {
        attemptedMap.set(cs.problemId?.toString(), cs);
      }
    }

    // Build review data
    const review = await Promise.all(
      allProblems.map(async (problem) => {
        const cs = attemptedMap.get(problem._id.toString());

        // Get best submission
        const bestSubmission = await Submission.findOne({
          userId: user._id,
          contestId,
          problemId: problem._id,
        })
          .sort({ score: -1 })
          .select("verdict score language testcasesPassed totalTestcases")
          .lean();

        const submissionCount = await Submission.countDocuments({
          userId: user._id,
          contestId,
          problemId: problem._id,
        });

        return {
          problem: {
            _id: problem._id,
            title: problem.title,
            difficulty: problem.difficulty,
            marks: problem.score,
          },
          bestVerdict: bestSubmission
            ? (bestSubmission as any).verdict
            : "NOT_ATTEMPTED",
          bestScore: cs?.score || (bestSubmission as any)?.score || 0,
          language: (bestSubmission as any)?.language || null,
          submissionCount,
          testcasesPassed: (bestSubmission as any)?.testcasesPassed || 0,
          totalTestcases: (bestSubmission as any)?.totalTestcases || 0,
        };
      })
    );

    return successResponse({ review });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Coding review error:", error);
    return errorResponse("Server error fetching coding review", 500);
  }
}
