import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import ContestMCQ from "@/lib/models/ContestMCQ";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser, type AuthenticatedUser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// Whitelisted fields — prevents mass-assignment (e.g. flipping isPublic/createdBy)
const MCQ_UPDATABLE_FIELDS = [
  "question", "options", "correctAnswers", "category", "difficulty",
  "marks", "negativeMarks", "explanation", "tags",
  "imageUrl", "imagePublicId", "images", "order",
] as const;

/**
 * Ownership rules (mirrors KodingKulture):
 * - ADMIN: full access
 * - ORGANISER on a library question: must be their own private question
 * - ORGANISER on a contest question: must own that contest
 * - ORGANISER on an orphan question: must be its creator
 */
async function requireMCQAccess(user: AuthenticatedUser, mcq: any) {
  if (user.role === "ADMIN") return;

  if (mcq.isLibrary) {
    if (mcq.createdBy?.toString() !== user._id.toString() || mcq.isPublic) {
      throw new Error("MCQ_FORBIDDEN");
    }
    return;
  }

  if (mcq.contestId) {
    await requireContestOwner(user, mcq.contestId.toString());
    return;
  }

  if (mcq.createdBy?.toString() !== user._id.toString()) {
    throw new Error("MCQ_FORBIDDEN");
  }
}

function mapAccessError(error: any) {
  if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
  if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
  if (error.message === "MCQ_FORBIDDEN")
    return errorResponse("You can only modify your own private questions", 403);
  if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
  if (error.message === "CONTEST_FORBIDDEN")
    return errorResponse("You can only modify questions in your own contests", 403);
  return null;
}

// PUT /api/mcqs/[id] — update an MCQ
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const mcq = await MCQ.findById(id);
    if (!mcq) return errorResponse("MCQ not found", 404);

    await requireMCQAccess(user, mcq);

    const body = await request.json();

    // Apply whitelisted fields only; admins may additionally set isPublic
    const allowed: string[] =
      user.role === "ADMIN" ? [...MCQ_UPDATABLE_FIELDS, "isPublic"] : [...MCQ_UPDATABLE_FIELDS];
    for (const key of allowed) {
      if (body[key] !== undefined) (mcq as any)[key] = body[key];
    }
    await mcq.save();

    return successResponse({ message: "MCQ updated", mcq });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Update MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}

// DELETE /api/mcqs/[id] — delete an MCQ
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const mcq = await MCQ.findById(id);
    if (!mcq) return errorResponse("MCQ not found", 404);

    await requireMCQAccess(user, mcq);

    await MCQ.findByIdAndDelete(id);

    // Library question: also remove its links from all contests
    if (mcq.isLibrary) {
      await ContestMCQ.deleteMany({ mcqId: id });
    }

    // Direct contest question: keep the contest's MCQ totalMarks in sync
    if (!mcq.isLibrary && mcq.contestId) {
      const contest = await Contest.findById(mcq.contestId);
      if (contest) {
        contest.sections.mcq.totalMarks = Math.max(
          0,
          (contest.sections.mcq.totalMarks || 0) - (mcq.marks || 0)
        );
        await contest.save();
      }
    }

    return successResponse({ message: "MCQ deleted" });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Delete MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}
