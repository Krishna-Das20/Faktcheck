import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestRegistration from "@/lib/models/ContestRegistration";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

type Params = { params: Promise<{ id: string }> };

// GET /api/contests/[id]/participants — get all participants (admin/organiser)
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();
    await requireContestOwner(user, id);

    // Get all registrations
    const registrations = await ContestRegistration.find({ contestId: id })
      .populate("userId", "name email college phone")
      .sort({ registeredAt: 1 });

    // Get all progress records
    const progressRecords = await ContestProgress.find({ contestId: id })
      .populate("userId", "name email college phone")
      .sort({ startedAt: 1 });

    // Build a combined view
    const participantMap = new Map<string, any>();

    // Add registrations
    for (const reg of registrations) {
      if (reg.userId) {
        const userId = (reg.userId as any)._id || reg.userId;
        participantMap.set(userId.toString(), {
          user: {
            id: userId,
            name: (reg.userId as any).name,
            email: (reg.userId as any).email,
            college: (reg.userId as any).college,
            phone: (reg.userId as any).phone,
          },
          registeredAt: reg.registeredAt,
          startedAt: null,
          submittedAt: null,
          status: "REGISTERED",
          terminationReason: null,
        });
      }
    }

    // Merge with progress records
    for (const prog of progressRecords) {
      if (prog.userId) {
        const userId = (prog.userId as any)._id || prog.userId;
        const key = userId.toString();
        const existing = participantMap.get(key) || {
          user: {
            id: userId,
            name: (prog.userId as any).name,
            email: (prog.userId as any).email,
            college: (prog.userId as any).college,
            phone: (prog.userId as any).phone,
          },
          registeredAt: null,
        };

        participantMap.set(key, {
          ...existing,
          startedAt: prog.startedAt,
          submittedAt: prog.submittedAt,
          status: prog.status || "IN_PROGRESS",
          terminationReason: prog.terminationReason,
          warningCount: prog.warningCount || 0,
          sectionStatuses: {
            mcq: prog.mcqProgress?.sectionStatus || "NOT_STARTED",
            coding: prog.codingProgress?.sectionStatus || "NOT_STARTED",
            forms: prog.formsProgress?.sectionStatus || "NOT_STARTED",
          },
          sectionTimes: {
            mcq: prog.mcqProgress?.sectionTimeSpent || 0,
            coding: prog.codingProgress?.sectionTimeSpent || 0,
            forms: prog.formsProgress?.sectionTimeSpent || 0,
          },
        });
      }
    }

    const participants = Array.from(participantMap.values());

    // Summary stats
    const stats = {
      totalRegistered: registrations.length,
      totalStarted: progressRecords.length,
      totalSubmitted: progressRecords.filter((p: any) => p.status === "SUBMITTED").length,
      totalTimedOut: progressRecords.filter((p: any) => p.status === "TIMED_OUT").length,
      totalMalpractice: progressRecords.filter((p: any) => p.terminationReason === "MALPRACTICE").length,
      notStarted: registrations.length - progressRecords.length,
    };

    return successResponse({ stats, participants });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("Get participants error:", error);
    return errorResponse("Server error fetching participants", 500);
  }
}
