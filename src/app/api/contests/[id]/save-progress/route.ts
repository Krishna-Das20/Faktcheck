import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { saveProgressSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/save-progress — periodic auto-save
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const { data, error } = await validateBody(request, saveProgressSchema);
    if (error) return error;

    // Extract validated fields + additional fields not covered by schema
    const body = await request.clone().json();
    const mcqAnswers = data.mcqAnswers;
    const timeSpent = data.timeSpent;
    const { type, questionId, problemId, category } = body;

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) return errorResponse("Contest not started");
    if (progress.status === "SUBMITTED") return errorResponse("Contest already submitted");

    // Save MCQ answers if provided
    if (mcqAnswers && mcqAnswers.length > 0) {
      progress.mcqProgress.answers = mcqAnswers as any;
    }

    // Track time if provided
    if (type && timeSpent !== undefined) {
      if (type === "mcq" && questionId) {
        const existing = progress.mcqProgress.questionTimes.find(
          (q: any) => q.questionId.toString() === questionId
        );
        if (existing) {
          existing.timeSpent += timeSpent;
          existing.answeredAt = new Date();
        } else {
          progress.mcqProgress.questionTimes.push({
            questionId,
            timeSpent,
            startedAt: new Date(),
            answeredAt: new Date(),
          });
        }
      } else if (type === "coding") {
        const pid = problemId || questionId;
        const existing = progress.codingProgress.problemTimes.find(
          (p: any) => p.problemId.toString() === pid
        );
        if (existing) {
          existing.timeSpent += timeSpent;
          existing.submittedAt = new Date();
        } else {
          progress.codingProgress.problemTimes.push({
            problemId: pid,
            timeSpent,
            startedAt: new Date(),
            submittedAt: new Date(),
          });
        }
      } else if (type === "mcq-section") {
        progress.mcqProgress.sectionTimeSpent = (progress.mcqProgress.sectionTimeSpent || 0) + timeSpent;
      } else if (type === "coding-section") {
        progress.codingProgress.sectionTimeSpent = (progress.codingProgress.sectionTimeSpent || 0) + timeSpent;
      } else if (type === "mcq-category" && category) {
        // Per-category time tracking
        const existingCat = progress.mcqProgress.categoryTimes?.find(
          (c: any) => c.category === category
        );
        if (existingCat) {
          existingCat.timeSpent += timeSpent;
        } else {
          if (!progress.mcqProgress.categoryTimes) {
            progress.mcqProgress.categoryTimes = [];
          }
          progress.mcqProgress.categoryTimes.push({ category, timeSpent });
        }
      }
    }

    await progress.save();

    return successResponse({ message: "Progress saved" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Save progress error:", error);
    return errorResponse("Server error saving progress", 500);
  }
}
