import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import Result from "@/lib/models/Result";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

type Params = { params: Promise<{ contestId: string; userId: string }> };

const VALID_DECISIONS = ["CLEARED", "CONFIRMED", "VOIDED", "PENDING"] as const;
type Decision = (typeof VALID_DECISIONS)[number];

// POST /api/proctor/[contestId]/review/[userId]
// A human reviewer's decision on a candidate's proctoring evidence:
//  - CLEARED   → dismiss flags; the candidate's result stands
//  - CONFIRMED → record that violations are genuine (label only)
//  - VOIDED    → nullify the attempt (score zeroed, kept for audit)
//  - PENDING   → reset to un-reviewed
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const reviewer = await requireAdminOrOrganiser(request);
    const { contestId, userId } = await params;
    await connectDB();
    await requireContestOwner(reviewer, contestId);

    const body = await request.json().catch(() => ({}));
    const decision = body.decision as Decision;
    const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

    if (!VALID_DECISIONS.includes(decision)) {
      return errorResponse("Invalid decision", 400);
    }

    const progress = await ContestProgress.findOne({ contestId, userId });
    if (!progress) return errorResponse("Attempt not found", 404);

    progress.reviewDecision = {
      status: decision,
      reviewedBy: reviewer._id as any,
      reviewedAt: new Date(),
      note,
    };
    await progress.save();

    // Voiding nullifies the score so the attempt can't win, but the record
    // (flags, evidence, decision) is preserved for audit.
    if (decision === "VOIDED") {
      await Result.findOneAndUpdate(
        { contestId, userId },
        { mcqScore: 0, codingScore: 0, formsScore: 0, totalScore: 0 }
      );
    }

    return successResponse({
      message: `Attempt marked ${decision.toLowerCase()}`,
      reviewDecision: progress.reviewDecision,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("Proctor review decision error:", error);
    return errorResponse("Server error recording decision", 500);
  }
}
