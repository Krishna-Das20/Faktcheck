import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/leaderboard/[contestId]/rank — Get current user's result + rank
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const result = await Result.findOne({
      userId: user._id,
      contestId,
    }).populate("userId", "name email");

    if (!result) {
      return errorResponse("No result found for this contest", 404);
    }

    return successResponse({ result });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get rank error:", error);
    return errorResponse("Server error fetching rank", 500);
  }
}
