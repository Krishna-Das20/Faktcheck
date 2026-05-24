import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/contests/[id]/progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    await connectDB();
    const { id } = await params;

    const progress = await ContestProgress.findOne({
      userId: user._id,
      contestId: id,
    });

    if (!progress) {
      return successResponse({ progress: null });
    }

    return successResponse({ progress });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get progress error:", error);
    return errorResponse("Server error", 500);
  }
}
