import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import Violation from "@/lib/models/Violation";
import MCQ from "@/lib/models/MCQ";
import MCQSubmission from "@/lib/models/MCQSubmission";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/violation — log a proctoring violation
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const { type, details } = await request.json();

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) return errorResponse("Contest not started");
    if (progress.status === "SUBMITTED") return errorResponse("Contest already submitted");

    // Increment warning count
    progress.warningCount = (progress.warningCount || 0) + 1;
    const warningCount = progress.warningCount;

    // Auto-terminate on 3 warnings
    let terminated = false;
    if (warningCount >= 3) {
      progress.status = "SUBMITTED";
      progress.submittedAt = new Date();
      progress.terminationReason = "MALPRACTICE";
      terminated = true;
    }

    await progress.save();

    // Log violation
    await Violation.create({
      userId: user._id,
      contestId: id,
      type,
      warningNumber: warningCount,
      details: details || null,
      timestamp: new Date(),
    });

    // On malpractice: create a Result record server-side
    // This ensures the user appears on the leaderboard even if the
    // client-side auto-submit (handleAutoSubmit) fails due to network issues.
    if (terminated) {
      try {
        const now = new Date();
        const totalTimeSpent = Math.floor(
          (now.getTime() - new Date(progress.startedAt).getTime()) / 1000
        );

        // Calculate MCQ score from saved progress answers
        let mcqScore = 0;
        const mcqAnswerDetails: any[] = [];
        const savedAnswers = progress.mcqProgress?.answers || [];

        if (savedAnswers.length > 0) {
          // Also save to MCQSubmission
          await MCQSubmission.findOneAndUpdate(
            { contestId: id, userId: user._id },
            { contestId: id, userId: user._id, answers: savedAnswers, submittedAt: now },
            { upsert: true, new: true }
          );

          for (const answer of savedAnswers) {
            const mcq = await MCQ.findById(answer.mcqId);
            if (mcq) {
              const correctAnswers = mcq.options
                .map((opt: any, idx: number) => (opt.isCorrect ? idx : -1))
                .filter((idx: number) => idx !== -1);

              const userAnswers = answer.selectedOptions || [];
              const isCorrect =
                userAnswers.length === correctAnswers.length &&
                userAnswers.every((ans: number) => correctAnswers.includes(ans));

              const marksAwarded = isCorrect ? mcq.marks || 1 : -(mcq.negativeMarks || 0);
              mcqScore += marksAwarded;

              mcqAnswerDetails.push({
                questionId: mcq._id,
                selectedOptions: userAnswers,
                isCorrect,
                marksAwarded,
              });
            }
          }
        }

        // Calculate coding score from existing accepted submissions
        let codingScore = 0;
        const codingSubmissionDetails: any[] = [];
        const userSubmissions = await Submission.find({
          userId: user._id,
          contestId: id,
          verdict: "ACCEPTED",
        });

        const problemScores: Record<string, any> = {};
        for (const sub of userSubmissions) {
          const pid = sub.problemId.toString();
          if (!problemScores[pid] || sub.score > problemScores[pid].score) {
            problemScores[pid] = sub;
          }
        }

        for (const [, sub] of Object.entries(problemScores)) {
          codingScore += sub.score || 0;
          codingSubmissionDetails.push({
            problemId: sub.problemId,
            bestSubmission: sub._id,
            score: sub.score || 0,
            solved: true,
          });
        }

        const totalScore = mcqScore + codingScore;

        // Create or update Result
        await Result.findOneAndUpdate(
          { contestId: id, userId: user._id },
          {
            contestId: id,
            userId: user._id,
            mcqScore,
            mcqAnswers: mcqAnswerDetails,
            codingScore,
            codingSubmissions: codingSubmissionDetails,
            totalScore,
            timeTaken: totalTimeSpent,
            startedAt: progress.startedAt,
            submittedAt: now,
            status: "SUBMITTED",
          },
          { upsert: true, new: true }
        );
      } catch (resultError) {
        // Log but don't fail the violation response — Result creation is best-effort
        console.error("Failed to create Result on malpractice:", resultError);
      }
    }

    return successResponse({
      message: warningCount >= 3 ? "Contest terminated due to malpractice" : "Violation logged",
      warningCount,
      terminated,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Log violation error:", error);
    return errorResponse("Server error logging violation", 500);
  }
}

// GET /api/contests/[id]/violation — get violations (admin/organiser)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const violations = await Violation.find({ contestId: id })
      .populate("userId", "name email")
      .sort({ timestamp: -1 });

    return successResponse({ violations });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Get violations error:", error);
    return errorResponse("Server error", 500);
  }
}

