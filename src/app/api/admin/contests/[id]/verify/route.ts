import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

// PUT /api/admin/contests/[id]/verify — Approve or reject a contest
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    await connectDB();

    const { status, rejectionReason } = await request.json();
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return errorResponse("Invalid status. Must be APPROVED or REJECTED.", 400);
    }

    const contest = await Contest.findById(id).populate("createdBy", "name email");
    if (!contest) return errorResponse("Contest not found", 404);

    contest.verificationStatus = status;
    if (status === "REJECTED" && rejectionReason) {
      (contest as any).rejectionReason = rejectionReason;
    }
    await contest.save();

    return successResponse({
      message: `Contest ${status.toLowerCase()}`,
      contest,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Verify contest error:", error);
    return errorResponse("Server error", 500);
  }
}
