import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import Room from "@/lib/models/Room";
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
import { successResponse, errorResponse, validateBody } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { updateContestSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

// GET /api/contests/[id]
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.PUBLIC_READ);
    if (limited) return limited;

    const { id } = await params;
    await connectDB();

    const contest = await Contest.findById(id).populate("createdBy", "name email").lean();
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
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    // Verify ownership — matches KK's contestOwner middleware
    if (user.role !== "ADMIN") {
      const existing = await Contest.findById(id);
      if (!existing) return errorResponse("Contest not found", 404);

      const isCreator = existing.createdBy.toString() === user._id.toString();

      // Check room co-organiser access
      let isRoomOrganiser = false;
      if (!isCreator && existing.roomId) {
        const room = await Room.findById(existing.roomId);
        if (room && room.isOrganiser(user._id)) {
          isRoomOrganiser = true;
        }
      }

      if (!isCreator && !isRoomOrganiser) {
        return errorResponse("Not authorized to edit this contest", 403);
      }

      // Block editing approved public contests (room contests remain editable)
      if (!existing.roomId && existing.verificationStatus === "APPROVED") {
        return errorResponse(
          "Public contest is approved. Only admin can make changes.",
          403
        );
      }
    }

    const { data: updateData, error: valError } = await validateBody(request, updateContestSchema);
    if (valError) return valError;

    // Build update payload (allow adding computed fields like status)
    const updatePayload: Record<string, unknown> = { ...updateData };

    // Auto-compute duration from start/end times if both are provided
    if (updateData.startTime && updateData.endTime) {
      const durationMs = new Date(updateData.endTime as string).getTime() - new Date(updateData.startTime as string).getTime();
      if (durationMs > 0) {
        updatePayload.duration = Math.round(durationMs / 60000);
      }
    }

    // Recalculate status if timing changed
    if (updateData.startTime || updateData.endTime) {
      const now = new Date();
      const existingContest =
        !updateData.startTime || !updateData.endTime ? await Contest.findById(id) : null;
      const startTime = new Date((updateData.startTime || existingContest?.startTime) as string);
      const endTime = new Date((updateData.endTime || existingContest?.endTime) as string);

      if (now < startTime) updatePayload.status = "UPCOMING";
      else if (now >= startTime && now <= endTime) updatePayload.status = "LIVE";
      else updatePayload.status = "ENDED";
    }

    const contest = await Contest.findByIdAndUpdate(id, updatePayload, {
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
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { id } = await params;
    await connectDB();

    if (user.role !== "ADMIN") {
      const existing = await Contest.findById(id);
      if (!existing) return errorResponse("Contest not found", 404);

      const isCreator = existing.createdBy.toString() === user._id.toString();

      // Check room co-organiser access
      let isRoomOrganiser = false;
      if (!isCreator && existing.roomId) {
        const room = await Room.findById(existing.roomId);
        if (room && room.isOrganiser(user._id)) {
          isRoomOrganiser = true;
        }
      }

      if (!isCreator && !isRoomOrganiser) {
        return errorResponse("Not authorized to delete this contest", 403);
      }

      // Block deleting approved public contests
      if (!existing.roomId && existing.verificationStatus === "APPROVED") {
        return errorResponse(
          "Public contest is approved. Only admin can delete it.",
          403
        );
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
