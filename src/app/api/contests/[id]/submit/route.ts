import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import MCQ from "@/lib/models/MCQ";
import MCQSubmission from "@/lib/models/MCQSubmission";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { finalSubmitSchema } from "@/lib/validations";

// Grace period (seconds) for final submit — accommodates auto-submit network delays
const SUBMIT_GRACE_SECONDS = 60;

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/submit
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_SUBMIT);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const { data, error } = await validateBody(request, finalSubmitSchema);
    if (error) return error;

    const { mcqAnswers } = data;

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) return errorResponse("Contest not started");
    if (progress.status === "SUBMITTED") return errorResponse("Contest already submitted");

    // Server-side timer validation
    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);

    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - new Date(progress.startedAt).getTime()) / 1000);
    const contestDurationSeconds = contest.duration * 60;
    const isLateSubmission = elapsedSeconds > contestDurationSeconds + SUBMIT_GRACE_SECONDS;

    // Cap timeTaken at contest duration — prevents inflated times from client manipulation
    const totalTimeSpent = Math.min(elapsedSeconds, contestDurationSeconds);

    if (isLateSubmission) {
      console.warn(`Late submission detected: user=${user._id}, contest=${id}, elapsed=${elapsedSeconds}s, limit=${contestDurationSeconds}s`);
    }

    // Update progress
    progress.submittedAt = now;
    progress.totalTimeSpent = totalTimeSpent;
    progress.status = "SUBMITTED";

    // Mark late submissions as TIMEOUT if not already terminated for another reason
    if (isLateSubmission && !progress.terminationReason) {
      progress.terminationReason = "TIMEOUT";
    }

    // Save MCQ answers
    if (mcqAnswers && mcqAnswers.length > 0) {
      progress.mcqProgress.answers = mcqAnswers as any;
      await MCQSubmission.findOneAndUpdate(
        { contestId: id, userId: user._id },
        { contestId: id, userId: user._id, answers: mcqAnswers, submittedAt: now },
        { upsert: true, new: true }
      );
    }

    await progress.save();

    // Calculate MCQ Score
    let mcqScore = 0;
    const mcqAnswerDetails: any[] = [];
    if (mcqAnswers && mcqAnswers.length > 0) {
      for (const answer of mcqAnswers) {
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

          // Update MCQ metrics
          mcq.metrics.attempted++;
          if (isCorrect) mcq.metrics.correct++;
          else mcq.metrics.wrong++;
          await mcq.save();
        }
      }
    }

    // Calculate Coding Score
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

    return successResponse({
      message: "Contest submitted successfully",
      totalTimeSpent,
      mcqScore,
      codingScore,
      totalScore,
      progress,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Final submit error:", error);
    return errorResponse("Server error submitting contest", 500);
  }
}
