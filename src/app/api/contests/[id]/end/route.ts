import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Submission from "@/lib/models/Submission";
import Result from "@/lib/models/Result";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { requireContestOwner } from "@/lib/contest-access";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/end - KK-compatible manual contest termination
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();
    const contest = await requireContestOwner(user, id);

    if (new Date(contest.endTime) < new Date()) {
      return errorResponse("Contest has already ended");
    }

    const [directMCQs, mcqLinks, directProblems, problemLinks, activeParticipants] =
      await Promise.all([
        MCQ.find({ contestId: id }),
        ContestMCQ.find({ contestId: id }).populate("mcqId"),
        CodingProblem.find({ contestId: id }),
        ContestCodingProblem.find({ contestId: id }).populate("problemId"),
        ContestProgress.find({ contestId: id, status: "IN_PROGRESS" }),
      ]);

    const allMCQs: any[] = [
      ...directMCQs,
      ...mcqLinks
        .filter((link: any) => link.mcqId)
        .map((link: any) => ({
          ...link.mcqId.toObject(),
          marks: link.marks ?? link.mcqId.marks,
        })),
    ];
    const allProblems: any[] = [
      ...directProblems,
      ...problemLinks
        .filter((link: any) => link.problemId)
        .map((link: any) => ({
          ...link.problemId.toObject(),
          score: link.score ?? link.problemId.score,
        })),
    ];

    let autoSubmittedCount = 0;
    for (const progress of activeParticipants) {
      try {
        let mcqScore = 0;
        for (const answer of progress.mcqProgress?.answers || []) {
          const mcq = allMCQs.find((item) => item._id.toString() === answer.mcqId.toString());
          if (!mcq) continue;

          const correctAnswers = mcq.options
            .map((option: any, index: number) => (option.isCorrect ? index : -1))
            .filter((index: number) => index !== -1);
          const selected = answer.selectedOptions || [];
          const isCorrect =
            correctAnswers.length === selected.length &&
            correctAnswers.every((index: number) => selected.includes(index));
          if (isCorrect) mcqScore += mcq.marks || 0;
        }

        let codingScore = 0;
        const codingSubmissions: any[] = [];
        for (const problem of allProblems) {
          const bestSubmission = await Submission.findOne({
            problemId: problem._id,
            contestId: id,
            userId: progress.userId,
            verdict: "ACCEPTED",
          }).sort({ score: -1 });
          if (!bestSubmission) continue;

          const score = bestSubmission.score || problem.score || 0;
          codingScore += score;
          codingSubmissions.push({
            problemId: problem._id,
            bestSubmission: bestSubmission._id,
            score,
            attempts: 1,
            solved: true,
          });
        }

        const now = new Date();
        await Result.findOneAndUpdate(
          { contestId: id, userId: progress.userId },
          {
            contestId: id,
            userId: progress.userId,
            mcqScore,
            codingScore,
            codingSubmissions,
            totalScore: mcqScore + codingScore,
            startedAt: progress.startedAt,
            submittedAt: now,
            timeTaken: Math.floor((now.getTime() - progress.startedAt.getTime()) / 1000),
            status: "SUBMITTED",
          },
          { upsert: true, new: true }
        );

        progress.status = "TIMED_OUT";
        progress.terminationReason = "TIMEOUT";
        progress.submittedAt = now;
        await progress.save();
        autoSubmittedCount++;
      } catch (participantError) {
        console.error(`Failed to auto-submit participant ${progress.userId}:`, participantError);
      }
    }

    contest.endTime = new Date();
    contest.status = "ENDED";
    contest.manuallyEnded = true;
    contest.endedBy = user._id as any;
    await contest.save();

    return successResponse({
      message: `Contest ended successfully. ${autoSubmittedCount} participants were auto-submitted.`,
      autoSubmittedCount,
      totalActiveParticipants: activeParticipants.length,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("End contest error:", error);
    return errorResponse("Server error ending contest", 500);
  }
}
