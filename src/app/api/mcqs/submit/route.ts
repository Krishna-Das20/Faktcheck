import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { submitMCQAnswersSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/mcqs/submit — Submit MCQ answers with scoring
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_SUBMIT);
    if (limited) return limited;

    const user = await requireAuth(request);

    const { data, error } = await validateBody(request, submitMCQAnswersSchema);
    if (error) return error;

    await connectDB();
    const { contestId, answers } = data;

    // Verify contest exists and user is registered
    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse("Contest not found", 404);

    const isRegistered = contest.participants?.some(
      (p: any) => p.toString() === user._id.toString()
    );
    if (!isRegistered && user.role !== "ADMIN") {
      return errorResponse("You are not registered for this contest", 403);
    }

    // Verify contest is in progress for this user
    const progress = await ContestProgress.findOne({
      contestId,
      userId: user._id,
    });
    if (!progress || progress.status === "SUBMITTED") {
      return errorResponse("Contest not in progress or already submitted", 400);
    }

    let totalScore = 0;
    const mcqAnswers: any[] = [];

    for (const answer of answers) {
      const mcq = await MCQ.findById(answer.questionId || answer.mcqId);
      if (!mcq) continue;

      // Derive correct answers from options.isCorrect
      const correctAnswers = mcq.options
        .map((opt: any, idx: number) => (opt.isCorrect ? idx : -1))
        .filter((idx: number) => idx !== -1);

      const selectedOptions = answer.selectedOptions || [];
      const isCorrect =
        selectedOptions.length === correctAnswers.length &&
        selectedOptions.every((a: number) => correctAnswers.includes(a));

      let marksAwarded = 0;
      if (isCorrect) {
        marksAwarded = mcq.marks;
      } else if (selectedOptions.length > 0) {
        marksAwarded = -(mcq.negativeMarks || 0);
      }

      totalScore += marksAwarded;

      mcqAnswers.push({
        questionId: mcq._id,
        selectedOptions,
        isCorrect,
        marksAwarded,
        timeTaken: answer.timeTaken || 0,
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
          { contestId, mcqId: mcq._id },
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

    // Upsert result
    const result = await Result.findOneAndUpdate(
      { userId: user._id, contestId },
      { mcqScore: totalScore, mcqAnswers },
      { new: true, upsert: true }
    );

    return successResponse({
      message: "MCQ answers submitted successfully",
      score: totalScore,
      result,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Submit MCQ error:", error);
    return errorResponse("Server error submitting MCQ answers", 500);
  }
}
