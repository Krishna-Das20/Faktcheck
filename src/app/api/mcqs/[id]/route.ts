import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import MCQ from "@/lib/models/MCQ";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// PUT /api/mcqs/[id] — update an MCQ
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
    const mcq = await MCQ.findByIdAndUpdate(id, body, { new: true, runValidators: true });

    if (!mcq) return errorResponse("MCQ not found", 404);

    return successResponse({ message: "MCQ updated", mcq });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
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

    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const mcq = await MCQ.findByIdAndDelete(id);
    if (!mcq) return errorResponse("MCQ not found", 404);

    return successResponse({ message: "MCQ deleted" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Delete MCQ error:", error);
    return errorResponse("Server error", 500);
  }
}
