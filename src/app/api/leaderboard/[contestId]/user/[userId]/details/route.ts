import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import ContestProgress from "@/lib/models/ContestProgress";
import MCQ from "@/lib/models/MCQ";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestMCQ from "@/lib/models/ContestMCQ";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Submission from "@/lib/models/Submission";
import FormSubmission from "@/lib/models/FormSubmission";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/leaderboard/[contestId]/user/[userId]/details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string; userId: string }> }
) {
  try {
    await requireAdminOrOrganiser(request);
    const { contestId, userId } = await params;
    await connectDB();

    // Get contest progress
    const progress = await ContestProgress.findOne({ contestId, userId })
      .populate("userId", "name email")
      .lean() as any;

    if (!progress) return errorResponse("No progress found", 404);

    // Get result for scores
    const result = await Result.findOne({ contestId, userId }).lean() as any;

    // --- MCQ Time Details ---
    const mcqIds = progress.mcqProgress?.questionTimes?.map((q: any) => q.questionId) || [];
    const mcqs = await MCQ.find({ _id: { $in: mcqIds } }).select("question category marks").lean() as any[];
    const mcqMap = new Map(mcqs.map((m: any) => [m._id.toString(), m]));

    const mcqTimeDetails = (progress.mcqProgress?.questionTimes || []).map((qt: any) => {
      const mcq = mcqMap.get(qt.questionId.toString());
      return {
        questionId: qt.questionId,
        questionText: mcq?.question?.substring(0, 50) + "..." || "Unknown",
        category: mcq?.category || "Unknown",
        timeSpent: qt.timeSpent,
        marks: mcq?.marks || 0,
      };
    });

    // --- Coding Time Details ---
    const problemIds = progress.codingProgress?.problemTimes?.map((p: any) => p.problemId) || [];
    const problems = await CodingProblem.find({ _id: { $in: problemIds } }).select("title category score").lean() as any[];
    const problemMap = new Map(problems.map((p: any) => [p._id.toString(), p]));

    const codingTimeDetails = (progress.codingProgress?.problemTimes || []).map((pt: any) => {
      const problem = problemMap.get(pt.problemId.toString());
      return {
        problemId: pt.problemId,
        title: problem?.title || "Unknown",
        category: problem?.category || "Unknown",
        timeSpent: pt.timeSpent,
        score: problem?.score || 0,
      };
    });

    // --- Category Time Breakdown ---
    const mcqCategoryTime: Record<string, number> = {};
    mcqTimeDetails.forEach((q: any) => {
      const cat = q.category || "Unknown";
      mcqCategoryTime[cat] = (mcqCategoryTime[cat] || 0) + q.timeSpent;
    });

    const codingCategoryTime: Record<string, number> = {};
    codingTimeDetails.forEach((p: any) => {
      const cat = p.category || "Unknown";
      codingCategoryTime[cat] = (codingCategoryTime[cat] || 0) + p.timeSpent;
    });

    // --- Forms Time ---
    const formSubmissions = await FormSubmission.find({ contestId, userId })
      .populate("formId", "title")
      .lean() as any[];

    const formsSectionTime = formSubmissions.reduce((t: number, s: any) => t + (s.timeTaken || 0), 0);
    const formsTimeDetails = formSubmissions.map((sub: any) => ({
      formId: sub.formId?._id || sub.formId,
      title: sub.formId?.title || "Unknown Form",
      timeSpent: sub.timeTaken || 0,
      score: sub.totalScore || 0,
      maxScore: sub.maxPossibleScore || 0,
      isEvaluated: sub.isFullyEvaluated,
    }));

    // --- MCQ Answer Details ---
    const directMcqs = await MCQ.find({ contestId }).select("question options marks negativeMarks category").lean() as any[];
    const junctionEntries = await ContestMCQ.find({ contestId })
      .populate({ path: "mcqId", select: "question options marks negativeMarks category" })
      .sort({ order: 1 })
      .lean() as any[];

    const allMcqMap = new Map<string, any>();
    for (const m of directMcqs) allMcqMap.set(m._id.toString(), m);
    for (const je of junctionEntries) {
      if (je.mcqId && !allMcqMap.has(je.mcqId._id.toString())) {
        allMcqMap.set(je.mcqId._id.toString(), {
          ...je.mcqId,
          marks: je.marks ?? je.mcqId.marks,
          negativeMarks: je.negativeMarks ?? je.mcqId.negativeMarks,
        });
      }
    }

    const answeredMcqMap = new Map<string, any>();
    if (result?.mcqAnswers) {
      for (const a of result.mcqAnswers) answeredMcqMap.set(a.questionId?.toString(), a);
    }

    const mcqAnswerDetails = Array.from(allMcqMap.values()).map((mcq: any) => {
      const answer = answeredMcqMap.get(mcq._id.toString());
      return {
        questionId: mcq._id,
        questionText: mcq.question,
        category: mcq.category || "Unknown",
        options: mcq.options?.map((opt: any, idx: number) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          wasSelected: answer ? (answer.selectedOptions || []).includes(idx) : false,
        })) || [],
        isCorrect: answer?.isCorrect || false,
        marksAwarded: answer?.marksAwarded || 0,
        maxMarks: mcq.marks || 1,
        unanswered: !answer,
      };
    });

    // --- Coding Submission Details ---
    const directProblems = await CodingProblem.find({ contestId }).select("title category score order").lean() as any[];
    const codingJunctions = await ContestCodingProblem.find({ contestId })
      .populate({ path: "problemId", select: "title category score" })
      .sort({ order: 1 })
      .lean() as any[];

    const problemMergeMap = new Map<string, any>();
    for (const p of directProblems) problemMergeMap.set(p._id.toString(), p);
    for (const je of codingJunctions) {
      if (je.problemId && !problemMergeMap.has(je.problemId._id.toString())) {
        problemMergeMap.set(je.problemId._id.toString(), {
          ...je.problemId,
          score: je.score ?? je.problemId.score,
          order: je.order ?? 0,
        });
      }
    }

    const allProblems = Array.from(problemMergeMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

    const codingAnswerDetails: any[] = [];
    for (const problem of allProblems) {
      const allSubs = await Submission.find({ userId, contestId, problemId: problem._id })
        .select("verdict score testcasesPassed totalTestcases language submittedAt")
        .sort({ submittedAt: 1 })
        .lean() as any[];

      if (allSubs.length > 0) {
        codingAnswerDetails.push({
          problemId: problem._id,
          title: problem.title,
          category: problem.category || "Unknown",
          maxScore: problem.score || 100,
          bestScore: Math.max(...allSubs.map((s: any) => s.score || 0), 0),
          solved: allSubs.some((s: any) => s.verdict === "ACCEPTED"),
          totalAttempts: allSubs.length,
          unanswered: false,
          submissions: allSubs.map((sub: any) => ({
            verdict: sub.verdict,
            score: sub.score,
            testcasesPassed: sub.testcasesPassed,
            totalTestcases: sub.totalTestcases,
            language: sub.language,
            submittedAt: sub.submittedAt,
          })),
        });
      } else {
        codingAnswerDetails.push({
          problemId: problem._id,
          title: problem.title,
          category: problem.category || "Unknown",
          maxScore: problem.score || 100,
          bestScore: 0, solved: false, totalAttempts: 0, unanswered: true, submissions: [],
        });
      }
    }

    return successResponse({
      userDetails: {
        user: progress.userId,
        contestId,
        startedAt: progress.startedAt,
        submittedAt: progress.submittedAt,
        totalTimeSpent: progress.totalTimeSpent,
        status: progress.status,
        mcqSectionTime: progress.mcqProgress?.sectionTimeSpent || 0,
        codingSectionTime: progress.codingProgress?.sectionTimeSpent || 0,
        formsSectionTime,
        mcqCategoryTime,
        codingCategoryTime,
        mcqTimeDetails,
        codingTimeDetails,
        formsTimeDetails,
        mcqAnswerDetails,
        codingAnswerDetails,
        mcqScore: result?.mcqScore || 0,
        codingScore: result?.codingScore || 0,
        formsScore: formSubmissions.reduce((t: number, s: any) => t + (s.totalScore || 0), 0),
        totalScore: result?.totalScore || 0,
        rank: result?.rank || null,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Get user detailed stats error:", error);
    return errorResponse("Server error", 500);
  }
}
