import { NextRequest } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import Contest from "@/lib/models/Contest";
import { requireAdminOrOrganiser, type AuthenticatedUser } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { updateFormSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";

/**
 * Ownership guard shared by GET/PUT/DELETE:
 * - admin: always allowed
 * - organiser: must own the contest (or be a room co-organiser)
 * - organiser modifications to APPROVED public contests are blocked
 *   (room contests stay editable — they're auto-approved by design)
 */
async function requireFormAccess(
  user: AuthenticatedUser,
  formId: string,
  { forModify = false }: { forModify?: boolean } = {}
) {
  const form = await Form.findById(formId);
  if (!form) throw new Error("FORM_NOT_FOUND");

  const contest = await requireContestOwner(user, form.contestId.toString());

  if (
    forModify &&
    user.role === "ORGANISER" &&
    contest.verificationStatus === "APPROVED" &&
    !contest.roomId
  ) {
    throw new Error("CONTEST_APPROVED_LOCKED");
  }

  return { form, contest };
}

function mapAccessError(error: any) {
  if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
  if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
  if (error.message === "FORM_NOT_FOUND") return errorResponse("Form not found", 404);
  if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
  if (error.message === "CONTEST_FORBIDDEN")
    return errorResponse("You can only manage forms for your own contests", 403);
  if (error.message === "CONTEST_APPROVED_LOCKED")
    return errorResponse("Contest is approved. Only admin can make changes.", 403);
  return null;
}

// GET /api/forms/[id] — Get form by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    await connectDB();
    const { id } = await params;

    await requireFormAccess(user, id);

    const form = await Form.findById(id).populate("createdBy", "name email");
    return successResponse({ form });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Get form error:", error);
    return errorResponse("Server error", 500);
  }
}

// PUT /api/forms/[id] — Update form
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const { data, error } = await validateBody(request, updateFormSchema);
    if (error) return error;

    const { form } = await requireFormAccess(user, id, { forModify: true });

    const oldTotalMarks = form.totalMarks || 0;

    if (data.title) form.title = data.title;
    if (data.description !== undefined) form.description = data.description;
    if (data.fields) {
      form.fields = data.fields.map((field, index) => ({
        ...field,
        fieldId: field.fieldId || crypto.randomUUID(),
        order: field.order ?? index,
      })) as any;
    }

    await form.save(); // pre-save hook recomputes totalMarks

    // Keep the contest's forms totalMarks in sync
    const contest = await Contest.findById(form.contestId);
    if (contest) {
      contest.sections.forms.totalMarks = Math.max(
        0,
        (contest.sections.forms.totalMarks || 0) - oldTotalMarks + (form.totalMarks || 0)
      );
      await contest.save();
    }

    return successResponse({ message: "Form updated", form });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Update form error:", error);
    return errorResponse("Server error", 500);
  }
}

// DELETE /api/forms/[id] — Delete form
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const { form } = await requireFormAccess(user, id, { forModify: true });

    // Keep the contest's forms section in sync; disable it when the last form goes
    const contest = await Contest.findById(form.contestId);
    if (contest) {
      contest.sections.forms.totalMarks = Math.max(
        0,
        (contest.sections.forms.totalMarks || 0) - (form.totalMarks || 0)
      );
      const remainingForms = await Form.countDocuments({
        contestId: form.contestId,
        _id: { $ne: form._id },
        isActive: true,
      });
      if (remainingForms === 0) {
        contest.sections.forms.enabled = false;
      }
      await contest.save();
    }

    await Form.findByIdAndDelete(id);

    return successResponse({ message: "Form deleted" });
  } catch (error: any) {
    const mapped = mapAccessError(error);
    if (mapped) return mapped;
    console.error("Delete form error:", error);
    return errorResponse("Server error", 500);
  }
}
