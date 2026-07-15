import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Form from "@/lib/models/Form";
import Contest from "@/lib/models/Contest";
import Room from "@/lib/models/Room";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/api-auth";

// GET /api/forms/contest/[contestId] — Get all forms for a contest
// Organisers/admins see full forms; participants get answer keys stripped.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    await connectDB();
    const { contestId } = await params;

    const contest = await Contest.findById(contestId);
    if (!contest) return errorResponse("Contest not found", 404);

    // Determine privilege: admin, contest creator, or room organiser
    const isCreator = contest.createdBy?.toString() === user._id.toString();
    let isPrivileged = user.role === "ADMIN" || (user.role === "ORGANISER" && isCreator);
    if (!isPrivileged && user.role === "ORGANISER" && contest.roomId) {
      const room = await Room.findById(contest.roomId);
      if (room?.isOrganiser(user._id)) isPrivileged = true;
    }

    // Participants must be registered for the contest
    const isParticipant = contest.participants?.some(
      (p) => p.toString() === user._id.toString()
    );
    if (!isPrivileged && !isParticipant) {
      return errorResponse("You are not registered for this contest", 403);
    }

    const forms = await Form.find({ contestId, isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    // Strip answer keys before sending forms to participants
    const sanitizedForms = isPrivileged
      ? forms
      : forms.map((form: any) => ({
          ...form,
          fields: (form.fields || []).map((field: any) => {
            const { correctAnswers, ...rest } = field;
            return rest;
          }),
        }));

    return successResponse({ forms: sanitizedForms });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Get contest forms error:", error);
    return errorResponse("Server error", 500);
  }
}
