import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import { requireAdminOrOrganiser, requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/forms — Create a new form
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrOrganiser(request);
    await connectDB();

    const body = await request.json();
    const form = await Form.create({
      ...body,
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
