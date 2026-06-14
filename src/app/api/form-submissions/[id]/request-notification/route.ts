import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/form-submissions/[id]/request-notification — Request email when evaluated
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const submission = await FormSubmission.findById(id);
    if (!submission) return errorResponse("Submission not found", 404);

    // Verify ownership
    if (submission.userId.toString() !== user._id?.toString()) {
      return errorResponse("Access denied", 403);
    }

    // Already fully evaluated
    if (submission.isFullyEvaluated) {
      return errorResponse("Submission has already been evaluated", 400);
    }

    submission.notifyOnEvaluate = true;
    await submission.save();

    return successResponse({
      message: "You will be notified via email when your submission is reviewed",
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Request notification error:", error);
    return errorResponse("Server error", 500);
  }
}
