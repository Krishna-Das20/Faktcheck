import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/track-time — track per-question/problem time
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const { type, questionId, problemId, timeSpent } = await request.json();

    if (!type || timeSpent === undefined) {
      return errorResponse("Missing required fields: type, timeSpent");
    }

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) {
      return errorResponse("Contest not started");
    }

    if (type === "mcq") {
      const qid = questionId;
      if (!qid) return errorResponse("Missing questionId for mcq tracking");

      const existing = progress.mcqProgress.questionTimes.find(
        (q: any) => q.questionId.toString() === qid
      );
      if (existing) {
        existing.timeSpent += timeSpent;
        existing.answeredAt = new Date();
      } else {
        progress.mcqProgress.questionTimes.push({
          questionId: qid,
          timeSpent,
          startedAt: new Date(),
          answeredAt: new Date(),
        });
      }
    } else if (type === "coding") {
      const pid = problemId || questionId;
      if (!pid) return errorResponse("Missing problemId for coding tracking");

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
      progress.mcqProgress.sectionTimeSpent =
        (progress.mcqProgress.sectionTimeSpent || 0) + timeSpent;
    } else if (type === "coding-section") {
      progress.codingProgress.sectionTimeSpent =
        (progress.codingProgress.sectionTimeSpent || 0) + timeSpent;
    }

    await progress.save();

    return successResponse({ message: "Time tracked" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Track time error:", error);
    return errorResponse("Server error tracking time", 500);
  }
}
