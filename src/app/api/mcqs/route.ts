import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/mcqs — create a contest-specific MCQ (optionally also save to library)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const { saveToLibrary, libraryIsPublic, ...mcqBody } = await request.json();

    const mcq = await MCQ.create({ ...mcqBody, createdBy: user._id });

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
    console.error("Create MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}
