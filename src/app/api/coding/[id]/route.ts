import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import CodingProblem from "@/lib/models/CodingProblem";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// PUT /api/coding/[id] — update a coding problem
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const body = await request.json();
    const problem = await CodingProblem.findByIdAndUpdate(id, body, { new: true, runValidators: true });

    if (!problem) return errorResponse("Problem not found", 404);

    return successResponse({ message: "Problem updated", problem });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
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

    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const problem = await CodingProblem.findByIdAndDelete(id);
    if (!problem) return errorResponse("Problem not found", 404);

    return successResponse({ message: "Problem deleted" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Delete coding problem error:", error);
    return errorResponse("Server error", 500);
  }
}
