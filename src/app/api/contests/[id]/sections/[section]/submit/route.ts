import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

const VALID_SECTIONS = ["mcq", "coding", "forms"] as const;
type SectionType = (typeof VALID_SECTIONS)[number];

const PROGRESS_KEY: Record<SectionType, string> = {
  mcq: "mcqProgress",
  coding: "codingProgress",
  forms: "formsProgress",
};

// Grace period (seconds) for section submit — accommodates network delays
const SUBMIT_GRACE_SECONDS = 60;

type Params = { params: Promise<{ id: string; section: string }> };

// POST /api/contests/[id]/sections/[section]/submit — Submit a section
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_SUBMIT);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id, section } = await params;

    if (!VALID_SECTIONS.includes(section as SectionType)) {
      return errorResponse("Invalid section. Must be mcq, coding, or forms.", 400);
    }

    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) return errorResponse("Contest not started");

    const progressKey = PROGRESS_KEY[section as SectionType];
    const sectionProgress = (progress as any)[progressKey];

    if (sectionProgress?.sectionStatus === "SUBMITTED") {
      return errorResponse(`${section} section already submitted`, 400);
    }

    if (sectionProgress?.sectionStatus !== "IN_PROGRESS") {
      return errorResponse(`${section} section not started`, 400);
    }

    const sectionConfig = contest.sections?.[section as SectionType];
    const sectionDuration = sectionConfig?.duration || 0;
    const hasTimer = sectionConfig?.hasTimer && sectionDuration > 0;
    const now = new Date();

    // Server-side timer validation (only if timer is enabled)
    let sectionTimeSpent = 0;
    if (sectionProgress.sectionStartedAt) {
      sectionTimeSpent = Math.floor(
        (now.getTime() - new Date(sectionProgress.sectionStartedAt).getTime()) / 1000
      );
    }

    if (hasTimer) {
      const isLate = sectionTimeSpent > sectionDuration * 60 + SUBMIT_GRACE_SECONDS;
      if (isLate) {
        console.warn(
          `Late section submit: user=${user._id}, contest=${id}, section=${section}, elapsed=${sectionTimeSpent}s, limit=${sectionDuration * 60}s`
        );
      }
      // Cap time at section duration
      sectionTimeSpent = Math.min(sectionTimeSpent, sectionDuration * 60);
    }

    // Parse request body for section-specific data
    const body = await request.json().catch(() => ({}));

    let sectionScore = 0;

    // ── MCQ Section Submit ──────────────────────────────────────
    if (section === "mcq") {
      const mcqAnswers = body.mcqAnswers || [];

      // Save answers to progress
      if (mcqAnswers.length > 0) {
        progress.mcqProgress.answers = mcqAnswers as any;
      }

      // Score MCQ answers
      const mcqAnswerDetails: any[] = [];
      for (const answer of mcqAnswers) {
        const mcq = await MCQ.findById(answer.mcqId || answer.questionId);
        if (!mcq) continue;

        const correctAnswers = mcq.options
          .map((opt: any, idx: number) => (opt.isCorrect ? idx : -1))
          .filter((idx: number) => idx !== -1);

        const selectedOptions = answer.selectedOptions || [];
        const isCorrect =
          selectedOptions.length === correctAnswers.length &&
          selectedOptions.every((a: number) => correctAnswers.includes(a));

        let marksAwarded = 0;
        if (isCorrect) {
          marksAwarded = mcq.marks || 1;
        } else if (selectedOptions.length > 0) {
          marksAwarded = -(mcq.negativeMarks || 0);
        }

        sectionScore += marksAwarded;
        mcqAnswerDetails.push({
          questionId: mcq._id,
          selectedOptions,
          isCorrect,
          marksAwarded,
        });

        // Update global MCQ metrics
        await MCQ.findByIdAndUpdate(mcq._id, {
          $inc: {
            "metrics.attempted": 1,
            "metrics.correct": isCorrect ? 1 : 0,
            "metrics.wrong": isCorrect ? 0 : 1,
          },
        });

        // Update contest-specific metrics for library MCQs
        if (mcq.isLibrary) {
          await ContestMCQ.findOneAndUpdate(
            { contestId: id, mcqId: mcq._id },
            {
              $inc: {
                "contestMetrics.attempted": 1,
                "contestMetrics.correct": isCorrect ? 1 : 0,
                "contestMetrics.wrong": isCorrect ? 0 : 1,
              },
            }
          );
        }
      }

      // Update Result with MCQ score
      await Result.findOneAndUpdate(
        { userId: user._id, contestId: id },
        { mcqScore: sectionScore, mcqAnswers: mcqAnswerDetails },
        { new: true, upsert: true }
      );
    }

    // ── Coding Section Submit ──────────────────────────────────
    if (section === "coding") {
      // Coding submissions are already saved via /api/submissions
      // Just finalize the best scores
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

      const codingSubmissionDetails: any[] = [];
      for (const [, sub] of Object.entries(problemScores)) {
        sectionScore += sub.score || 0;
        codingSubmissionDetails.push({
          problemId: sub.problemId,
          bestSubmission: sub._id,
          score: sub.score || 0,
          solved: true,
        });
      }

      // Update Result with coding score
      await Result.findOneAndUpdate(
        { userId: user._id, contestId: id },
        { codingScore: sectionScore, codingSubmissions: codingSubmissionDetails },
        { new: true, upsert: true }
      );
    }

    // ── Forms Section Submit ──────────────────────────────────
    // Forms submissions are handled by /api/form-submissions
    // Just mark the section as submitted

    // ── Mark section as submitted ──────────────────────────────
    (progress as any)[progressKey].sectionStatus = "SUBMITTED";
    (progress as any)[progressKey].sectionSubmittedAt = now;
    (progress as any)[progressKey].sectionTimeSpent = sectionTimeSpent;

    // Check if ALL enabled sections are now submitted
    const allSubmitted = checkAllSectionsSubmitted(contest, progress);
    if (allSubmitted) {
      progress.status = "SUBMITTED";
      progress.submittedAt = now;
      progress.terminationReason = "COMPLETED";

      // Calculate total time
      const totalTime =
        (progress.mcqProgress?.sectionTimeSpent || 0) +
        (progress.codingProgress?.sectionTimeSpent || 0) +
        (progress.formsProgress?.sectionTimeSpent || 0);
      progress.totalTimeSpent = totalTime;

      // Finalize the Result with total score and status
      const result = await Result.findOne({ userId: user._id, contestId: id });
      if (result) {
        result.totalScore = (result.mcqScore || 0) + (result.codingScore || 0);
        result.timeTaken = totalTime;
        result.status = "SUBMITTED";
        result.submittedAt = now;
        await result.save();
      }
    }

    await progress.save();

    return successResponse({
      message: `${section} section submitted successfully`,
      sectionScore,
      sectionTimeSpent,
      allSectionsSubmitted: allSubmitted,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Submit section error:", error);
    return errorResponse("Server error submitting section", 500);
  }
}

/**
 * Check if all enabled sections have been submitted.
 */
function checkAllSectionsSubmitted(contest: any, progress: any): boolean {
  const sections = contest.sections;

  if (sections?.mcq?.enabled && progress.mcqProgress?.sectionStatus !== "SUBMITTED") {
    return false;
  }
  if (sections?.coding?.enabled && progress.codingProgress?.sectionStatus !== "SUBMITTED") {
    return false;
  }
  if (sections?.forms?.enabled && progress.formsProgress?.sectionStatus !== "SUBMITTED") {
    return false;
  }

  return true;
}
