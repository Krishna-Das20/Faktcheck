import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/submissions/problem/[problemId] — Get user submissions for a problem
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ problemId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { problemId } = await params;
    await connectDB();

    const { searchParams } = new URL(request.url);
    const contestId = searchParams.get("contestId");

    const filter: any = {
      userId: user._id,
      problemId,
    };

    // Filter by contest if provided
    if (contestId) {
      filter.contestId = contestId;
    }

    const submissions = await Submission.find(filter)
      .sort({ submittedAt: -1 })
      .select("-sourceCode"); // Don't send full source in list view

    return successResponse({
      count: submissions.length,
      submissions,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get submissions error:", error);
    return errorResponse("Server error fetching submissions", 500);
  }
}
