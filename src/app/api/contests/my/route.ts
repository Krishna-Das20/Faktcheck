import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/contests/my — User's registered contests
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    await connectDB();

    const contests = await Contest.find({ participants: user._id }).sort({ startTime: -1 });

    return successResponse({ count: contests.length, contests });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get my contests error:", error);
    return errorResponse("Server error fetching contests", 500);
  }
}
