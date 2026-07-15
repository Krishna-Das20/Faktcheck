import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import MCQ from "@/lib/models/MCQ";
import MCQSubmission from "@/lib/models/MCQSubmission";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { successResponse, errorResponse } from "@/lib/api-utils";

// Allow the cron enough time to score a backlog of expired attempts
export const maxDuration = 60;

// Grace period after a user's time expires before we force-submit them —
// gives the client-side auto-submit a chance to land first
const AUTO_SUBMIT_GRACE_MS = 30 * 1000;

// Cap the number of attempts scored per cron run so a large backlog
// can't push the function past its time limit (rest is picked up next run)
const MAX_AUTO_SUBMITS_PER_RUN = 100;

// GET /api/cron/update-statuses — Cron job to update contest statuses
// and auto-submit expired IN_PROGRESS attempts
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this header).
    // This endpoint force-submits attempts, so in production it must never
    // run unprotected — refuse outright if no CRON_SECRET is configured.
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      console.error("CRON_SECRET is not configured — refusing to run cron in production");
      return errorResponse("Cron secret not configured", 503);
    }
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDB();
    const now = new Date();

    // Update UPCOMING → LIVE (published contests only)
    const toLive = await Contest.updateMany(
      { status: "UPCOMING", startTime: { $lte: now }, endTime: { $gt: now }, isPublished: true },
      { $set: { status: "LIVE" } }
    );

    // Update LIVE → ENDED
    const toEnded = await Contest.updateMany(
      { status: "LIVE", endTime: { $lte: now } },
      { $set: { status: "ENDED" } }
    );

    // Also catch any UPCOMING that should be ENDED (if cron missed a cycle)
    const skippedToEnded = await Contest.updateMany(
      { status: "UPCOMING", endTime: { $lte: now } },
      { $set: { status: "ENDED" } }
    );

    // ── Auto-submit expired IN_PROGRESS attempts ────────────────
    // Users who started a contest and disconnected would otherwise stay
    // IN_PROGRESS forever, never get a Result, and never reach the leaderboard.
    let autoSubmitted = 0;
    let autoSubmitErrors = 0;

    const inProgress = await ContestProgress.find({ status: "IN_PROGRESS" })
      .sort({ startedAt: 1 })
      .limit(MAX_AUTO_SUBMITS_PER_RUN)
      .populate("contestId");

    for (const progress of inProgress) {
      const contest: any = progress.contestId;
      if (!contest || !contest.duration) continue;

      const startedAtMs = new Date(progress.startedAt).getTime();
      const expiresAtMs = startedAtMs + contest.duration * 60 * 1000;
      if (now.getTime() <= expiresAtMs + AUTO_SUBMIT_GRACE_MS) continue;

      try {
        await autoSubmitExpiredAttempt(progress, contest, now);
        autoSubmitted++;
      } catch (err) {
        autoSubmitErrors++;
        console.error(
          `Auto-submit failed: user=${progress.userId}, contest=${contest._id}:`,
          err
        );
      }
    }

    return successResponse({
      message: "Contest statuses updated",
      updates: {
        toLive: toLive.modifiedCount,
        toEnded: toEnded.modifiedCount + skippedToEnded.modifiedCount,
        autoSubmitted,
        autoSubmitErrors,
      },
    });
  } catch (error: any) {
    console.error("Cron update-statuses error:", error);
    return errorResponse("Server error", 500);
  }
}

/**
 * Score and finalise a single expired attempt. Mirrors the server-side
 * scoring used by the final-submit and malpractice paths:
 * - MCQ score from the answers auto-saved into ContestProgress
 * - Coding score from the best ACCEPTED submission per problem
 */
async function autoSubmitExpiredAttempt(progress: any, contest: any, now: Date) {
  const contestId = contest._id;
  const userId = progress.userId;

  const elapsedSeconds = Math.floor(
    (now.getTime() - new Date(progress.startedAt).getTime()) / 1000
  );
  // Cap recorded time at the contest duration
  const totalTimeSpent = Math.min(elapsedSeconds, contest.duration * 60);

  progress.status = "SUBMITTED";
  progress.submittedAt = now;
  progress.totalTimeSpent = totalTimeSpent;
  progress.terminationReason = progress.terminationReason || "TIMEOUT";
  await progress.save();

  // ── MCQ score from auto-saved answers ─────────────────────────
  let mcqScore = 0;
  const mcqAnswerDetails: any[] = [];
  const savedAnswers = progress.mcqProgress?.answers || [];

  if (savedAnswers.length > 0) {
    await MCQSubmission.findOneAndUpdate(
      { contestId, userId },
      { contestId, userId, answers: savedAnswers, submittedAt: now },
      { upsert: true, new: true }
    );

    for (const answer of savedAnswers) {
      const mcq = await MCQ.findById(answer.mcqId);
      if (!mcq) continue;

      const correctAnswers = mcq.options
        .map((opt: any, idx: number) => (opt.isCorrect ? idx : -1))
        .filter((idx: number) => idx !== -1);

      const userAnswers = answer.selectedOptions || [];
      const isCorrect =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((ans: number) => correctAnswers.includes(ans));

      let marksAwarded = 0;
      if (isCorrect) {
        marksAwarded = mcq.marks || 1;
      } else if (userAnswers.length > 0) {
        marksAwarded = -(mcq.negativeMarks || 0);
      }
      mcqScore += marksAwarded;

      mcqAnswerDetails.push({
        questionId: mcq._id,
        selectedOptions: userAnswers,
        isCorrect,
        marksAwarded,
      });
    }
  }

  // ── Coding score from best ACCEPTED submissions ────────────────
  let codingScore = 0;
  const codingSubmissionDetails: any[] = [];
  const userSubmissions = await Submission.find({
    userId,
    contestId,
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

  await Result.findOneAndUpdate(
    { contestId, userId },
    {
      contestId,
      userId,
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
}
