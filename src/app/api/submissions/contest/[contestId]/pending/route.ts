import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Submission from "@/lib/models/Submission";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/submissions/contest/[contestId]/pending — admin/organiser only
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();

    const submissions = await Submission.find({
      contestId,
      verdict: "JUDGE0_UNAVAILABLE",
    })
      .populate("userId", "name email")
      .populate("problemId", "title difficulty score")
      .select(
        "userId problemId sourceCode language languageId verdict errorMessage submittedAt"
      )
      .sort({ submittedAt: -1 });

    return successResponse({
      count: submissions.length,
      submissions,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED")
      return errorResponse("Insufficient permissions", 403);
    console.error("Get pending submissions error:", error);
    return errorResponse("Server error fetching pending submissions", 500);
  }
}
