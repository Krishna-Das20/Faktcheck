import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestRegistration from "@/lib/models/ContestRegistration";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/contests/[id]/registration-status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    await connectDB();
    const { id } = await params;

    const registration = await ContestRegistration.findOne({
      userId: user._id,
      contestId: id,
    });

    const progress = await ContestProgress.findOne({
      userId: user._id,
      contestId: id,
    });

    return successResponse({
      isRegistered: !!registration,
      hasStarted: !!progress,
      status: progress?.status || null,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Registration status error:", error);
    return errorResponse("Server error", 500);
  }
}
