import mongoose from "mongoose";
import MCQ from "@/lib/models/MCQ";
import MCQSubmission from "@/lib/models/MCQSubmission";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import type { IContestProgress } from "@/lib/models/ContestProgress";

type IdLike = string | mongoose.Types.ObjectId;

/**
 * Score and finalise an attempt server-side, then upsert its Result.
 *
 * Shared by every path that ends an attempt without a client-supplied payload:
 * - proctoring termination (risk threshold / catastrophic flag)
 * - the auto-submit cron (timeout)
 * - the malpractice violation path
 *
 * MCQ score comes from the answers auto-saved into ContestProgress (with
 * negative marking); coding score from the best ACCEPTED submission per problem.
 * Returns the computed scores. Idempotent: safe to call once per termination.
 */
export async function scoreAttemptFromProgress(
  progress: IContestProgress,
  opts: {
    contestId: IdLike;
    userId: IdLike;
    now?: Date;
    timeTaken?: number;
  }
): Promise<{ mcqScore: number; codingScore: number; totalScore: number }> {
  const now = opts.now ?? new Date();
  const contestId = opts.contestId;
  const userId = opts.userId;

  // ── MCQ score from auto-saved answers ──────────────────────────
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
  const timeTaken =
    opts.timeTaken ??
    Math.floor((now.getTime() - new Date(progress.startedAt).getTime()) / 1000);

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
      timeTaken,
      startedAt: progress.startedAt,
      submittedAt: now,
      status: "SUBMITTED",
    },
    { upsert: true, new: true }
  );

  return { mcqScore, codingScore, totalScore };
}
