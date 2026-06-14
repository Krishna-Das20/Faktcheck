import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/forms/[id] — Get form by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdminOrOrganiser(request);
    await connectDB();
    const { id } = await params;
    const form = await Form.findById(id).populate("createdBy", "name email");
    if (!form) return errorResponse("Form not found", 404);
    return successResponse({ form });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
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

    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const body = await request.json();
    const form = await Form.findByIdAndUpdate(id, body, { new: true });
    if (!form) return errorResponse("Form not found", 404);

    return successResponse({ message: "Form updated", form });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
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

    await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    const form = await Form.findByIdAndDelete(id);
    if (!form) return errorResponse("Form not found", 404);

    return successResponse({ message: "Form deleted" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Delete form error:", error);
    return errorResponse("Server error", 500);
  }
}
