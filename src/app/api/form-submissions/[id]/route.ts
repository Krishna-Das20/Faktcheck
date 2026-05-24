import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import Form from "@/lib/models/Form";
import Contest from "@/lib/models/Contest";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/form-submissions/[id] — Get submission by ID (admin/organiser)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const submission = await FormSubmission.findById(id)
      .populate("userId", "name email")
      .populate("formId", "title fields totalMarks")
      .populate("evaluatedBy", "name");

    if (!submission) return errorResponse("Submission not found", 404);

    // Verify access for organiser
    if (user.role === "ORGANISER") {
      const form = await Form.findById((submission.formId as any)?._id || submission.formId);
      if (form) {
        const contest = await Contest.findById(form.contestId).select("createdBy");
        if (contest && contest.createdBy?.toString() !== user._id?.toString()) {
          return errorResponse("Access denied", 403);
        }
      }
    }

    return successResponse({ submission });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Get submission error:", error);
    return errorResponse("Server error", 500);
  }
}
