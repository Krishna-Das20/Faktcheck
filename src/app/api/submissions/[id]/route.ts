import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/submissions/[id] — Get a single submission by ID (includes sourceCode)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const submission = await Submission.findById(id)
      .populate("problemId", "title")
      .populate("userId", "name email")
      .lean();

    if (!submission) {
      return errorResponse("Submission not found", 404);
    }

    // Only owner, admin, or organiser can view
    const submissionUserId = submission.userId?._id?.toString() || submission.userId?.toString();
    if (
      submissionUserId !== user._id.toString() &&
      user.role !== "ADMIN" &&
      user.role !== "ORGANISER"
    ) {
      return errorResponse("Not authorized to view this submission", 403);
    }

    return successResponse({ submission });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Get submission by ID error:", error);
    return errorResponse("Server error fetching submission", 500);
  }
}
