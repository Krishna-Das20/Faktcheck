import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/mcqs/library — get library MCQs
export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const query: Record<string, unknown> = { isLibrary: true };
    if (user.role === "ORGANISER") {
      query.$or = [{ createdBy: user._id }, { isPublic: true }];
    }

    const category = request.nextUrl.searchParams.get("category");
    const difficulty = request.nextUrl.searchParams.get("difficulty");
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const mcqs = await MCQ.find(query).sort({ createdAt: -1 }).populate("createdBy", "name email");

    return successResponse({ count: mcqs.length, mcqs });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Get library MCQs error:", error);
    return errorResponse("Server error", 500);
  }
}

// POST /api/mcqs/library — create library MCQ
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const body = await request.json();
    const mcq = await MCQ.create({
      ...body,
      isLibrary: true,
      createdBy: user._id,
      // Default to private; only admins can explicitly set isPublic: true
      isPublic: user.role === "ADMIN" ? (body.isPublic === true) : false,
    });

    return successResponse({ message: "Library MCQ created", mcq }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Create library MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}
