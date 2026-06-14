import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// GET /api/admin/contests/pending — Get pending contests for verification
export async function GET(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdmin(request);
    await connectDB();

    const contests = await Contest.find({ verificationStatus: "PENDING" })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return successResponse({ contests });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Get pending contests error:", error);
    return errorResponse("Server error", 500);
  }
}
