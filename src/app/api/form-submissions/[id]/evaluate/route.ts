import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import Form from "@/lib/models/Form";
import Contest from "@/lib/models/Contest";
import Result from "@/lib/models/Result";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { sendMail } from "@/lib/email";
import { evaluateSubmissionSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// PUT /api/form-submissions/[id]/evaluate — Evaluate a form submission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;

    const { data, error } = await validateBody(request, evaluateSubmissionSchema);
    if (error) return error;

    await connectDB();

    const { evaluations } = data;
    // evaluations: Array of { fieldId, manualScore, feedback }

    const submission = await FormSubmission.findById(id)
      .populate("userId", "name email");

    if (!submission) return errorResponse("Submission not found", 404);

    // Check ownership for organiser
    if (user.role === "ORGANISER") {
      const form = await Form.findById(submission.formId);
      if (form) {
        const contest = await Contest.findById(form.contestId).select("createdBy");
        if (contest && contest.createdBy?.toString() !== user._id?.toString()) {
          return errorResponse("Access denied — you can only evaluate your own contests", 403);
        }
      }
    }

    // Apply evaluations with score capping and feedback
    if (Array.isArray(evaluations)) {
      evaluations.forEach((evaluation: any) => {
        const response = submission.responses.find(
          (r: any) => r.fieldId === evaluation.fieldId
        );
        if (response && !response.isAutoScored) {
          // Cap score at maxMarks
          response.manualScore = Math.min(
            Number(evaluation.manualScore) || 0,
            response.maxMarks
          );
          response.feedback = evaluation.feedback || "";
          response.isEvaluated = true;
        }
      });
    }

    submission.evaluatedBy = user._id as any;
    submission.evaluatedAt = new Date();
    await submission.save(); // pre-save hook recalculates totals

    // Send email notification to participant if they requested it
    if (submission.notifyOnEvaluate && (submission.userId as any)?.email) {
      try {
        const form = await Form.findById(submission.formId).select("title");
        await sendMail({
          to: (submission.userId as any).email,
          subject: `Your Form Submission Has Been Reviewed - ${form?.title || "Form"}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1e293b; color: #f1f5f9; border-radius: 12px;">
              <h2 style="color: #FF6B35;">🎉 Your Form Has Been Reviewed!</h2>
              <p>Hello ${(submission.userId as any).name},</p>
              <p>Great news! Your form submission for <strong style="color: #22c55e;">${form?.title || "the contest form"}</strong> has been reviewed.</p>
              <p>Log in to your account to view your detailed results and feedback.</p>
              <div style="margin: 20px 0; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/contest/${submission.contestId}/review"
                   style="background: #FF6B35; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  View Your Results
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 12px;">Best of luck!</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error("Failed to send evaluation email:", emailError);
      }
    }

    // Update the Result model with the new forms score
    try {
      const userId = (submission.userId as any)?._id || submission.userId;

      // Get ALL form submissions for this user + contest
      const allFormSubmissions = await FormSubmission.find({
        userId,
        contestId: submission.contestId,
      });

      let totalFormsScore = 0;
      let allEvaluated = true;

      for (const fs of allFormSubmissions) {
        totalFormsScore += fs.totalScore || 0;
        if (!fs.isFullyEvaluated) {
          allEvaluated = false;
        }
      }

      // Update the Result
      const result = await Result.findOne({
        userId,
        contestId: submission.contestId,
      });

      if (result) {
        result.formsScore = totalFormsScore;
        result.isFormsEvaluated = allEvaluated;
        // Recalculate total score
        result.totalScore = (result.mcqScore || 0) + (result.codingScore || 0) + totalFormsScore;

        if (allEvaluated && result.status === "SUBMITTED") {
          result.status = "EVALUATED";
        }

        await result.save();
      }
    } catch (resultError) {
      console.error("Failed to update Result with forms score:", resultError);
    }

    return successResponse({
      message: "Evaluation saved",
      submission: {
        _id: submission._id,
        totalScore: submission.totalScore,
        totalAutoScore: submission.totalAutoScore,
        totalManualScore: submission.totalManualScore,
        isFullyEvaluated: submission.isFullyEvaluated,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Evaluate submission error:", error);
    return errorResponse("Server error", 500);
  }
}
