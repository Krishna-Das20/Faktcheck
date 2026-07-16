import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import ProctorFlag from "@/lib/models/ProctorFlag";
import User from "@/lib/models/User";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireContestOwner } from "@/lib/contest-access";
import { FLAG_LABELS, RISK_TERMINATE_THRESHOLD, RISK_WARN_THRESHOLD } from "@/lib/proctoring";
import { getSignedEvidenceUrl } from "@/lib/cloudinary";

type Params = { params: Promise<{ contestId: string; userId: string }> };

// GET /api/proctor/[contestId]/session/[userId]
// One candidate's proctoring session: flag timeline + signed evidence URLs.
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const reviewer = await requireAdminOrOrganiser(request);
    const { contestId, userId } = await params;
    await connectDB();
    await requireContestOwner(reviewer, contestId);

    const [progress, candidate, flags] = await Promise.all([
      ContestProgress.findOne({ contestId, userId }).lean(),
      User.findById(userId).select("name email college phone").lean(),
      ProctorFlag.find({ contestId, userId }).sort({ startedAt: 1 }).lean(),
    ]);

    if (!candidate) return errorResponse("Candidate not found", 404);

    const timeline = flags.map((f: any) => ({
      _id: f._id,
      type: f.type,
      label: FLAG_LABELS[f.type as keyof typeof FLAG_LABELS] || f.type,
      source: f.source,
      confidence: f.confidence,
      weight: f.weight,
      startedAt: f.startedAt,
      endedAt: f.endedAt,
      durationMs: f.durationMs,
      details: f.details,
      // Resolve a short-lived signed URL when evidence media exists
      evidenceUrl: f.evidenceKey
        ? getSignedEvidenceUrl(f.evidenceKey, {
            resourceType: f.source === "audio" ? "video" : "image",
          })
        : null,
    }));

    const mp = (progress as any)?.mediaProctoring || {};

    return successResponse({
      candidate,
      session: {
        status: (progress as any)?.status || null,
        terminationReason: (progress as any)?.terminationReason || null,
        riskScore: (progress as any)?.riskScore || 0,
        startedAt: (progress as any)?.startedAt || null,
        submittedAt: (progress as any)?.submittedAt || null,
        consentGivenAt: mp.consentGivenAt || null,
        identityPhotoUrl: getSignedEvidenceUrl(mp.identityPhotoKey),
        cameraActive: mp.cameraActive || false,
        lastSnapshotAt: mp.lastSnapshotAt || null,
        reviewDecision: (progress as any)?.reviewDecision || { status: "PENDING" },
      },
      timeline,
      thresholds: { warn: RISK_WARN_THRESHOLD, terminate: RISK_TERMINATE_THRESHOLD },
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Insufficient permissions", 403);
    if (error.message === "CONTEST_NOT_FOUND") return errorResponse("Contest not found", 404);
    if (error.message === "CONTEST_FORBIDDEN") return errorResponse("Access denied", 403);
    console.error("Proctor session error:", error);
    return errorResponse("Server error", 500);
  }
}
