import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import Result from "@/lib/models/Result";
import ContestProgress from "@/lib/models/ContestProgress";
import ContestRegistration from "@/lib/models/ContestRegistration";
import Submission from "@/lib/models/Submission";
import MCQSubmission from "@/lib/models/MCQSubmission";
import FormSubmission from "@/lib/models/FormSubmission";
import Violation from "@/lib/models/Violation";
import MCQ from "@/lib/models/MCQ";
import CodingProblem from "@/lib/models/CodingProblem";
import ContestMCQ from "@/lib/models/ContestMCQ";
import ContestCodingProblem from "@/lib/models/ContestCodingProblem";
import { requireAuth, requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// GET /api/contests/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await connectDB();

    const contest = await Contest.findById(id).populate("createdBy", "name email");
    if (!contest) return errorResponse("Contest not found", 404);

    return successResponse({ contest });
  } catch (error) {
    console.error("Get contest error:", error);
    return errorResponse("Server error fetching contest", 500);
  }
}

// PUT /api/contests/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    // Verify ownership (admin can edit any, organiser only their own)
    if (user.role !== "ADMIN") {
      const existing = await Contest.findById(id);
      if (!existing) return errorResponse("Contest not found", 404);
      if (existing.createdBy.toString() !== user._id) {
        return errorResponse("Not authorized to edit this contest", 403);
      }
    }

    const updateData = await request.json();

    // Recalculate status if timing changed
    if (updateData.startTime || updateData.endTime) {
      const now = new Date();
      const existingContest =
        !updateData.startTime || !updateData.endTime ? await Contest.findById(id) : null;
      const startTime = new Date(updateData.startTime || existingContest?.startTime);
      const endTime = new Date(updateData.endTime || existingContest?.endTime);

      if (now < startTime) updateData.status = "UPCOMING";
      else if (now >= startTime && now <= endTime) updateData.status = "LIVE";
      else updateData.status = "ENDED";
    }

    const contest = await Contest.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!contest) return errorResponse("Contest not found", 404);

    return successResponse({ message: "Contest updated successfully", contest });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Update contest error:", error);
    return errorResponse("Server error updating contest", 500);
  }
}

// DELETE /api/contests/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    if (user.role !== "ADMIN") {
      const existing = await Contest.findById(id);
      if (!existing) return errorResponse("Contest not found", 404);
      if (existing.createdBy.toString() !== user._id) {
        return errorResponse("Not authorized to delete this contest", 403);
      }
    }

    const contest = await Contest.findByIdAndDelete(id);
    if (!contest) return errorResponse("Contest not found", 404);

    // Cascade delete
    await Promise.all([
      Result.deleteMany({ contestId: id }),
      ContestProgress.deleteMany({ contestId: id }),
      ContestRegistration.deleteMany({ contestId: id }),
      Submission.deleteMany({ contestId: id }),
      MCQSubmission.deleteMany({ contestId: id }),
      FormSubmission.deleteMany({ contestId: id }),
      Violation.deleteMany({ contestId: id }),
      MCQ.deleteMany({ contestId: id, isLibrary: { $ne: true } }),
      CodingProblem.deleteMany({ contestId: id, isLibrary: { $ne: true } }),
      ContestMCQ.deleteMany({ contestId: id }),
      ContestCodingProblem.deleteMany({ contestId: id }),
    ]);

    return successResponse({ message: "Contest and all related data deleted successfully" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    console.error("Delete contest error:", error);
    return errorResponse("Server error deleting contest", 500);
  }
}
