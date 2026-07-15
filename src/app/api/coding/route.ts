import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// POST /api/coding — create a contest-specific coding problem (optionally also save to library)
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    // isLibrary/isPublic are controlled server-side, never taken from the body
    const { saveToLibrary, libraryIsPublic, isLibrary, isPublic, ...problemBody } =
      await request.json();

    // Only the contest owner (or a room co-organiser / admin) may add problems
    if (problemBody.contestId) {
      await requireContestOwner(user, problemBody.contestId);
    }

    const problem = await CodingProblem.create({
      ...problemBody,
      isLibrary: false,
      isPublic: false,
      createdBy: user._id,
    });

    // Keep the contest's coding totalMarks in sync
    if (problem.contestId) {
      const contest = await Contest.findById(problem.contestId);
      if (contest) {
        contest.sections.coding.totalMarks =
          (contest.sections.coding.totalMarks || 0) + (problem.score || 0);
        await contest.save();
      }
    }

    // Optionally save a copy to the library
    let libraryProblem = null;
    if (saveToLibrary) {
      const libData = { ...problemBody };
      delete libData.contestId;
      delete libData.order;
      libraryProblem = await CodingProblem.create({
        ...libData,
        isLibrary: true,
        contestId: null,
        createdBy: user._id,
        isPublic: user.role === "ADMIN" ? (libraryIsPublic === true) : false,
      });
    }

    return successResponse({
      message: saveToLibrary ? "Problem created and saved to library" : "Problem created successfully",
      problem,
      libraryProblem,
    }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only add problems to your own contests", 403);
    console.error("Create coding problem error:", error);
    return errorResponse("Server error", 500);
  }
}
