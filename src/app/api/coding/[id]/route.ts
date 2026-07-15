import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser, type AuthenticatedUser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// Whitelisted fields — prevents mass-assignment (e.g. flipping isPublic/createdBy)
const CODING_UPDATABLE_FIELDS = [
  "title", "description", "inputFormat", "outputFormat", "constraints",
  "examples", "testcases", "category", "difficulty", "score",
  "timeLimit", "memoryLimit", "tags",
  "imageUrl", "imagePublicId", "images", "order",
] as const;

/**
 * Ownership rules (mirrors KodingKulture):
 * - ADMIN: full access
 * - ORGANISER on a library problem: must be their own private problem
 * - ORGANISER on a contest problem: must own that contest
 * - ORGANISER on an orphan problem: must be its creator
 */
async function requireProblemAccess(user: AuthenticatedUser, problem: any) {
  if (user.role === "ADMIN") return;

  if (problem.isLibrary) {
    if (problem.createdBy?.toString() !== user._id.toString() || problem.isPublic) {
      throw new Error("PROBLEM_FORBIDDEN");
    }
    return;
  }

  if (problem.contestId) {
    await requireContestOwner(user, problem.contestId.toString());
    return;
  }

  if (problem.createdBy?.toString() !== user._id.toString()) {
    throw new Error("PROBLEM_FORBIDDEN");
  }
}

function mapAccessError(error: any) {
  if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
  if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
  if (error.message === "PROBLEM_FORBIDDEN")
    return errorResponse("You can only modify your own private problems", 403);
  if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
  if (error.message === "CONTEST_FORBIDDEN")
    return errorResponse("You can only modify problems in your own contests", 403);
  return null;
}

// PUT /api/coding/[id] — update a coding problem
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

    const problem = await CodingProblem.findById(id);
    if (!problem) return errorResponse("Problem not found", 404);

    await requireProblemAccess(user, problem);

    const body = await request.json();

    // Apply whitelisted fields only; admins may additionally set isPublic
    const allowed: string[] =
      user.role === "ADMIN" ? [...CODING_UPDATABLE_FIELDS, "isPublic"] : [...CODING_UPDATABLE_FIELDS];
    for (const key of allowed) {
      if (body[key] !== undefined) (problem as any)[key] = body[key];
    }
    await problem.save();

    return successResponse({ message: "Problem updated", problem });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Update coding problem error:", error);
    return errorResponse("Server error", 500);
  }
}

// DELETE /api/coding/[id] — delete a coding problem
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

    const problem = await CodingProblem.findById(id);
    if (!problem) return errorResponse("Problem not found", 404);

    await requireProblemAccess(user, problem);

    await CodingProblem.findByIdAndDelete(id);

    // Library problem: also remove its links from all contests
    if (problem.isLibrary) {
      await ContestCodingProblem.deleteMany({ problemId: id });
    }

    // Direct contest problem: keep the contest's coding totalMarks in sync
    if (!problem.isLibrary && problem.contestId) {
      const contest = await Contest.findById(problem.contestId);
      if (contest) {
        contest.sections.coding.totalMarks = Math.max(
          0,
          (contest.sections.coding.totalMarks || 0) - (problem.score || 0)
        );
        await contest.save();
      }
    }

    return successResponse({ message: "Problem deleted" });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Delete coding problem error:", error);
    return errorResponse("Server error", 500);
  }
}
