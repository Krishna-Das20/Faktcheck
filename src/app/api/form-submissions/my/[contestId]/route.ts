import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ contestId: string }> };

// GET /api/form-submissions/my/[contestId] — Get own submissions for a contest
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const formId = request.nextUrl.searchParams.get("formId");

    const filter: any = {
      contestId,
      userId: user._id,
    };
    if (formId) filter.formId = formId;

    const submissions = await FormSubmission.find(filter)
      .populate("formId", "title totalMarks fields");

    return successResponse({ submissions });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get my submission error:", error);
    return errorResponse("Server error", 500);
  }
}
