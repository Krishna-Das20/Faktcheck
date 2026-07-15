import { NextRequest } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { createFormSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

// POST /api/forms — Create a new form
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);

    const { data, error } = await validateBody(request, createFormSchema);
    if (error) return error;

    await connectDB();

    // Only the contest owner (or a room co-organiser / admin) may attach forms
    await requireContestOwner(user, data.contestId);

    // Ensure every field has a fieldId and an order
    const fields = data.fields.map((field, index) => ({
      ...field,
      fieldId: field.fieldId || crypto.randomUUID(),
      order: field.order ?? index,
    }));

    const form = await Form.create({
      ...data,
      fields,
      createdBy: user._id,
    });

    // Enable the forms section and keep the contest's totalMarks in sync
    const contest = await Contest.findById(data.contestId);
    if (contest) {
      contest.sections.forms.enabled = true;
      contest.sections.forms.totalMarks =
        (contest.sections.forms.totalMarks || 0) + (form.totalMarks || 0);
      await contest.save();
    }

    return successResponse({ message: "Form created", form }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN")
      return errorResponse("You can only create forms for your own contests", 403);
    console.error("Create form error:", error);
    return errorResponse("Server error", 500);
  }
}
