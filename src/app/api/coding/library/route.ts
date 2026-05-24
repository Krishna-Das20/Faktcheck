import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/coding/library
export async function GET(request: NextRequest) {
  try {
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

    const problems = await CodingProblem.find(query).sort({ createdAt: -1 }).populate("createdBy", "name email");

    return successResponse({ count: problems.length, problems });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Get library problems error:", error);
    return errorResponse("Server error", 500);
  }
}

// POST /api/coding/library
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const body = await request.json();
    const problem = await CodingProblem.create({
      ...body,
      isLibrary: true,
      createdBy: user._id,
      // Default to private; only admins can explicitly set isPublic: true
      isPublic: user.role === "ADMIN" ? (body.isPublic === true) : false,
    });

    return successResponse({ message: "Library problem created", problem }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Create library problem error:", error);
    return errorResponse("Server error", 500);
  }
}
