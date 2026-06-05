import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/results/[resultId] — Get result by ID (for certificate page)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { resultId } = await params;
    await connectDB();

    const result = await Result.findById(resultId)
      .populate("userId", "name email")
      .populate("contestId", "title");

    if (!result) {
      return errorResponse("Result not found", 404);
    }

    // Only allow the result owner or admin to view
    const resultUserId = (result.userId as any)?._id?.toString() || result.userId?.toString();
    if (resultUserId !== user._id.toString() && user.role !== "ADMIN") {
      return errorResponse("Not authorized to view this result", 403);
    }

    return successResponse({ result });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get result error:", error);
    return errorResponse("Server error", 500);
  }
}
