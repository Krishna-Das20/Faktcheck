import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import ContestRegistration from "@/lib/models/ContestRegistration";
import Result from "@/lib/models/Result";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/register
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { id } = await params;
    await connectDB();

    const contest = await Contest.findById(id);
    if (!contest) return errorResponse("Contest not found", 404);
    if (contest.status === "ENDED") return errorResponse("Cannot register for an ended contest");

    // Check if already registered
    const existing = await ContestRegistration.findOne({ contestId: id, userId: user._id });
    if (existing) return errorResponse("Already registered for this contest");

    // Check max participants
    if (contest.maxParticipants && contest.participants.length >= contest.maxParticipants) {
      return errorResponse("Contest is full");
    }

    // Create registration
    await ContestRegistration.create({ contestId: id, userId: user._id, registeredAt: new Date() });

    // Add to participants array
    if (!contest.participants.map((p: any) => p.toString()).includes(user._id)) {
      contest.participants.push(user._id as any);
      await contest.save();
    }

    // Create result entry
    const existingResult = await Result.findOne({ userId: user._id, contestId: id });
    if (!existingResult) {
      await Result.create({ userId: user._id, contestId: id, status: "REGISTERED" });
    }

    const updatedContest = await Contest.findById(id).populate("createdBy", "name email");

    return successResponse({ message: "Successfully registered for contest", contest: updatedContest });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Register contest error:", error);
    return errorResponse("Server error registering for contest", 500);
  }
}
