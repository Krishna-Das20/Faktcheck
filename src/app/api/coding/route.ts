import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/coding — create a contest-specific coding problem (optionally also save to library)
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const { saveToLibrary, libraryIsPublic, ...problemBody } = await request.json();

    const problem = await CodingProblem.create({ ...problemBody, createdBy: user._id });

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
    console.error("Create coding problem error:", error);
    return errorResponse("Server error", 500);
  }
}
