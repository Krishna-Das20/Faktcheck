import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/start — Start the contest (creates progress entry)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);
    if (!contest.participants.map((p: any) => p.toString()).includes(user._id)) {
      return errorResponse("You are not registered for this contest", 403);
    }
    if (contest.status !== "LIVE") {
      return errorResponse("Contest is not currently live");
    }

    // Check if already started
    let progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (progress) {
      return successResponse({
        message: "Contest already started",
        progress,
        sectionStatuses: {
          mcq: progress.mcqProgress?.sectionStatus || "NOT_STARTED",
          coding: progress.codingProgress?.sectionStatus || "NOT_STARTED",
          forms: progress.formsProgress?.sectionStatus || "NOT_STARTED",
        },
        contest: {
          title: contest.title,
          sections: contest.sections,
          status: contest.status,
        },
      });
    }

    // Create new progress
    progress = await ContestProgress.create({
      contestId: id,
      userId: user._id,
      startedAt: new Date(),
      status: "IN_PROGRESS",
    });

    return successResponse(
      {
        message: "Contest started",
        progress,
        sectionStatuses: {
          mcq: "NOT_STARTED",
          coding: "NOT_STARTED",
          forms: "NOT_STARTED",
        },
        contest: {
          title: contest.title,
          sections: contest.sections,
          status: contest.status,
        },
      },
      201
    );
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Start contest error:", error);
    return errorResponse("Server error starting contest", 500);
  }
}

// GET /api/contests/[id]/start — Get progress & section statuses
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) {
      return successResponse({ started: false, message: "Contest not started yet" });
    }

    return successResponse({
      started: true,
      progress,
      sectionStatuses: {
        mcq: progress.mcqProgress?.sectionStatus || "NOT_STARTED",
        coding: progress.codingProgress?.sectionStatus || "NOT_STARTED",
        forms: progress.formsProgress?.sectionStatus || "NOT_STARTED",
      },
      contest: {
        title: contest.title,
        duration: contest.duration,
        sections: contest.sections,
        status: contest.status,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get progress error:", error);
    return errorResponse("Server error fetching progress", 500);
  }
}
