import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestProgress from "@/lib/models/ContestProgress";
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

type Params = { params: Promise<{ id: string; section: string }> };

// POST /api/contests/[id]/sections/[section]/start — Start a section timer
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id, section } = await params;

    if (!VALID_SECTIONS.includes(section as SectionType)) {
      return errorResponse("Invalid section. Must be mcq, coding, or forms.", 400);
    }

    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);
    if (contest.status !== "LIVE") return errorResponse("Contest is not currently live");

    // Check section is enabled
    const sectionConfig = contest.sections?.[section as SectionType];
    if (!sectionConfig?.enabled) {
      return errorResponse(`${section} section is not enabled for this contest`, 400);
    }

    // Check user is registered
    if (!contest.participants.map((p: any) => p.toString()).includes(user._id.toString())) {
      return errorResponse("You are not registered for this contest", 403);
    }

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) return errorResponse("Contest not started. Start the contest first.");

    const progressKey = PROGRESS_KEY[section as SectionType];
    const sectionProgress = (progress as any)[progressKey];

    // Already submitted — block re-entry
    if (sectionProgress?.sectionStatus === "SUBMITTED") {
      return errorResponse(`${section} section already submitted. Cannot re-enter.`, 400);
    }

    // Already in progress — return remaining time
    if (sectionProgress?.sectionStatus === "IN_PROGRESS" && sectionProgress.sectionStartedAt) {
      const sectionDuration = sectionConfig.duration || 0; // minutes
      const hasTimer = sectionConfig.hasTimer && sectionDuration > 0;

      if (hasTimer) {
        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(sectionProgress.sectionStartedAt).getTime()) / 1000
        );
        const remainingTime = Math.max(0, sectionDuration * 60 - elapsedSeconds);
        return successResponse({
          message: `${section} section already in progress`,
          sectionStatus: "IN_PROGRESS",
          remainingTime,
          hasTimer: true,
          sectionDuration,
        });
      }

      return successResponse({
        message: `${section} section already in progress`,
        sectionStatus: "IN_PROGRESS",
        remainingTime: null,
        hasTimer: false,
        sectionDuration: 0,
      });
    }

    // Start the section
    const now = new Date();
    (progress as any)[progressKey] = {
      ...((progress as any)[progressKey] || {}),
      sectionStartedAt: now,
      sectionStatus: "IN_PROGRESS",
    };
    await progress.save();

    const sectionDuration = sectionConfig.duration || 0;
    const hasTimer = sectionConfig.hasTimer && sectionDuration > 0;

    return successResponse(
      {
        message: `${section} section started`,
        sectionStatus: "IN_PROGRESS",
        remainingTime: hasTimer ? sectionDuration * 60 : null,
        hasTimer,
        sectionDuration,
      },
      201
    );
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Start section error:", error);
    return errorResponse("Server error starting section", 500);
  }
}

// GET /api/contests/[id]/sections/[section]/start — Get section status & remaining time
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id, section } = await params;

    if (!VALID_SECTIONS.includes(section as SectionType)) {
      return errorResponse("Invalid section", 400);
    }

    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);

    const progress = await ContestProgress.findOne({ contestId: id, userId: user._id });
    if (!progress) {
      return successResponse({ sectionStatus: "NOT_STARTED", remainingTime: null, hasTimer: false });
    }

    const progressKey = PROGRESS_KEY[section as SectionType];
    const sectionProgress = (progress as any)[progressKey];
    const sectionConfig = contest.sections?.[section as SectionType];
    const sectionDuration = sectionConfig?.duration || 0;
    const hasTimer = sectionConfig?.hasTimer && sectionDuration > 0;

    if (!sectionProgress || sectionProgress.sectionStatus === "NOT_STARTED") {
      return successResponse({ sectionStatus: "NOT_STARTED", remainingTime: null, hasTimer: !!hasTimer, sectionDuration });
    }

    if (sectionProgress.sectionStatus === "SUBMITTED") {
      return successResponse({ sectionStatus: "SUBMITTED", remainingTime: 0, hasTimer: !!hasTimer, sectionDuration });
    }

    // IN_PROGRESS
    if (hasTimer && sectionProgress.sectionStartedAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - new Date(sectionProgress.sectionStartedAt).getTime()) / 1000
      );
      const remainingTime = Math.max(0, sectionDuration * 60 - elapsedSeconds);
      return successResponse({ sectionStatus: "IN_PROGRESS", remainingTime, hasTimer: true, sectionDuration });
    }

    return successResponse({ sectionStatus: "IN_PROGRESS", remainingTime: null, hasTimer: false, sectionDuration: 0 });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get section status error:", error);
    return errorResponse("Server error", 500);
  }
}
