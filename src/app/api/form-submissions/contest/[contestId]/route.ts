import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/form-submissions/contest/[contestId] — Get all submissions for a contest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();

    // Check contest ownership for organiser
    const contest = await Contest.findById(contestId).select("createdBy");
    if (!contest) return errorResponse("Contest not found", 404);

    if (user.role === "ORGANISER" && contest.createdBy?.toString() !== user._id?.toString()) {
      return errorResponse("Access denied", 403);
    }

    const formId = request.nextUrl.searchParams.get("formId");
    const filter: any = { contestId };
    if (formId) filter.formId = formId;

    const submissions = await FormSubmission.find(filter)
      .populate("userId", "name email")
      .populate("formId", "title totalMarks")
      .sort({ submittedAt: -1 })
      .lean();

    return successResponse({ count: submissions.length, submissions });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Get contest submissions error:", error);
    return errorResponse("Server error", 500);
  }
}
