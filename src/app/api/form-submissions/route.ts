import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import FormSubmission from "@/lib/models/FormSubmission";
import Form from "@/lib/models/Form";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/form-submissions — Submit a form
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await connectDB();

    const { formId, contestId, responses, timeTaken } = await request.json();

    // Check for existing submission
    const existing = await FormSubmission.findOne({ formId, userId: user._id });
    if (existing) return errorResponse("Already submitted", 400);

    // Get form for auto-scoring
    const form = await Form.findById(formId);
    if (!form) return errorResponse("Form not found", 404);

    // Build responses with auto-scoring
    const processedResponses = form.fields.map((field) => {
      const userResp = responses?.find((r: any) => r.fieldId === field.fieldId);
      const value = userResp?.value ?? null;
      let autoScore = 0;

      if (field.isAutoScored && field.correctAnswers?.length > 0) {
        if (field.type === "RADIO") {
          autoScore = field.correctAnswers.includes(value as string) ? field.marks : 0;
        } else if (field.type === "CHECKBOX") {
          const userVals = Array.isArray(value) ? value : [];
          const correct = field.correctAnswers.sort().join(",");
          const userSorted = userVals.sort().join(",");
          autoScore = correct === userSorted ? field.marks : 0;
        }
      }

      return {
        fieldId: field.fieldId,
        value,
        isAutoScored: field.isAutoScored,
        autoScore,
        manualScore: null,
        maxMarks: field.marks,
        isEvaluated: field.isAutoScored,
        feedback: "",
      };
    });

    const submission = await FormSubmission.create({
      formId,
      contestId,
      userId: user._id,
      responses: processedResponses,
      timeTaken: timeTaken || 0,
    });

    return successResponse({ message: "Form submitted", submission }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.code === 11000) return errorResponse("Already submitted", 400);
    console.error("Submit form error:", error);
    return errorResponse("Server error", 500);
  }
}
