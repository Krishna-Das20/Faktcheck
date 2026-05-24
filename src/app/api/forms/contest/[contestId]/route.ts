import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/forms/contest/[contestId] — Get all forms for a contest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    await connectDB();
    const { contestId } = await params;

    const forms = await Form.find({ contestId, isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    return successResponse({ forms });
  } catch (error: any) {
    console.error("Get contest forms error:", error);
    return errorResponse("Server error", 500);
  }
}
