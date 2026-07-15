import { NextRequest } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import ProctorFlag from "@/lib/models/ProctorFlag";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";
import { RISK_TERMINATE_THRESHOLD, RISK_WARN_THRESHOLD } from "@/lib/proctoring";

type Params = { params: Promise<{ contestId: string }> };

// GET /api/proctor/[contestId]/overview
// Reviewer triage: every candidate ranked by risk score, with flag counts.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAdminOrOrganiser(request);
    const { contestId } = await params;
    await connectDB();
    await requireContestOwner(user, contestId);

    // Per-candidate flag counts
    const flagCounts = await ProctorFlag.aggregate([
      { $match: { contestId: new mongoose.Types.ObjectId(contestId) } },
      { $group: { _id: "$userId", flagCount: { $sum: 1 } } },
    ]);
    const flagCountMap = new Map<string, number>(
      flagCounts.map((f: any) => [f._id.toString(), f.flagCount])
    );

    const progresses = await ContestProgress.find({ contestId })
      .populate("userId", "name email college")
      .sort({ riskScore: -1 })
      .lean();

    const candidates = progresses.map((p: any) => ({
      user: p.userId,
      riskScore: p.riskScore || 0,
      flagCount: flagCountMap.get(p.userId?._id?.toString()) || 0,
      status: p.status,
      terminationReason: p.terminationReason,
      startedAt: p.startedAt,
      submittedAt: p.submittedAt,
      cameraActive: p.mediaProctoring?.cameraActive || false,
      identityPhotoKey: p.mediaProctoring?.identityPhotoKey || null,
    }));

    const stats = {
      total: candidates.length,
      terminated: candidates.filter((c) => c.terminationReason === "MALPRACTICE").length,
      highRisk: candidates.filter((c) => c.riskScore >= RISK_TERMINATE_THRESHOLD).length,
      flagged: candidates.filter((c) => c.riskScore >= RISK_WARN_THRESHOLD).length,
    };

    return successResponse({
      candidates,
      stats,
      thresholds: {
        warn: RISK_WARN_THRESHOLD,
        terminate: RISK_TERMINATE_THRESHOLD,
      },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("Proctor overview error:", error);
    return errorResponse("Server error", 500);
  }
}
