import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/api-auth";

// GET /api/forms/contest/[contestId] — Get all forms for a contest
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAuth(request);
    await connectDB();
    const { contestId } = await params;

    const forms = await Form.find({ contestId, isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    return successResponse({ forms });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get contest forms error:", error);
    return errorResponse("Server error", 500);
  }
}
