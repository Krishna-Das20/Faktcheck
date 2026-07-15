import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// POST /api/mcqs — create a contest-specific MCQ (optionally also save to library)
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    // isLibrary/isPublic are controlled server-side, never taken from the body
    const { saveToLibrary, libraryIsPublic, isLibrary, isPublic, ...mcqBody } =
      await request.json();

    // Only the contest owner (or a room co-organiser / admin) may add questions
    if (mcqBody.contestId) {
      await requireContestOwner(user, mcqBody.contestId);
    }

    const mcq = await MCQ.create({
      ...mcqBody,
      isLibrary: false,
      isPublic: false,
      createdBy: user._id,
    });

    // Keep the contest's MCQ totalMarks in sync
    if (mcq.contestId) {
      const contest = await Contest.findById(mcq.contestId);
      if (contest) {
        contest.sections.mcq.totalMarks =
          (contest.sections.mcq.totalMarks || 0) + (mcq.marks || 0);
        await contest.save();
      }
    }

    // Optionally save a copy to the library
    let libraryMcq = null;
    if (saveToLibrary) {
      const libData = { ...mcqBody };
      delete libData.contestId;
      delete libData.order;
      libraryMcq = await MCQ.create({
        ...libData,
        isLibrary: true,
        contestId: null,
        createdBy: user._id,
        isPublic: user.role === "ADMIN" ? (libraryIsPublic === true) : false,
      });
    }

    return successResponse({
      message: saveToLibrary ? "MCQ created and saved to library" : "MCQ created successfully",
      mcq,
      libraryMcq,
    }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only add questions to your own contests", 403);
    console.error("Create MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}
