import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { createFormSchema } from "@/lib/validations";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/forms — Create a new form
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);

    const { data, error } = await validateBody(request, createFormSchema);
    if (error) return error;

    await connectDB();
    const form = await Form.create({
      ...data,
      createdBy: user._id,
    });

    return successResponse({ message: "Form created", form }, 201);
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Create form error:", error);
    return errorResponse("Server error", 500);
  }
}
