import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import ProctorFlag, {
  PROCTOR_FLAG_TYPES,
  type ProctorFlagType,
} from "@/lib/models/ProctorFlag";
import Violation from "@/lib/models/Violation";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import {
  weightForFlag,
  FLAG_SOURCE,
  RISK_WARN_THRESHOLD,
  RISK_TERMINATE_THRESHOLD,
  CATASTROPHIC_FLAGS,
} from "@/lib/proctoring";
import { scoreAttemptFromProgress } from "@/lib/score-attempt";

type Params = { params: Promise<{ contestId: string }> };

interface IncomingFlag {
  type: ProctorFlagType;
  confidence?: number;
  durationMs?: number;
  evidenceKey?: string | null;
  details?: string | null;
  startedAt?: string;
}

const isValidType = (t: unknown): t is ProctorFlagType =>
  typeof t === "string" && (PROCTOR_FLAG_TYPES as readonly string[]).includes(t);

// The 6 legacy Violation.type values — dual-written so the existing
// violations dashboard keeps working during the transition to ProctorFlag.
const LEGACY_VIOLATION_TYPES = new Set([
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "WINDOW_BLUR",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "SCREENSHOT_ATTEMPT",
]);

// POST /api/proctor/[contestId]/flag — batched proctoring flag ingestion
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const body = await request.json().catch(() => ({}));
    const rawFlags: IncomingFlag[] = Array.isArray(body.flags)
      ? body.flags
      : body.type
        ? [body as IncomingFlag]
        : [];

    if (rawFlags.length === 0) {
      return errorResponse("No flags provided", 400);
    }

    const progress = await ContestProgress.findOne({ contestId, userId: user._id });
    if (!progress) return errorResponse("Contest not started");
    if (progress.status === "SUBMITTED" || progress.status === "TIMED_OUT") {
      return errorResponse("Contest already submitted");
    }

    let addedRisk = 0;
    let hasCatastrophic = false;
    const docs: any[] = [];

    for (const f of rawFlags) {
      if (!isValidType(f.type)) continue;

      const confidence =
        typeof f.confidence === "number" ? Math.min(Math.max(f.confidence, 0), 1) : 1;
      const weight = weightForFlag(f.type, confidence);
      addedRisk += weight;
      if (CATASTROPHIC_FLAGS.includes(f.type)) hasCatastrophic = true;

      const startedAt = f.startedAt ? new Date(f.startedAt) : new Date();
      const durationMs = typeof f.durationMs === "number" ? f.durationMs : 0;

      docs.push({
        contestId,
        userId: user._id,
        type: f.type,
        source: FLAG_SOURCE[f.type],
        confidence,
        weight,
        startedAt,
        endedAt: durationMs > 0 ? new Date(startedAt.getTime() + durationMs) : null,
        durationMs,
        evidenceKey: f.evidenceKey || null,
        details: f.details || null,
      });
    }

    if (docs.length === 0) return errorResponse("No valid flags provided", 400);

    await ProctorFlag.insertMany(docs);

    // Keep the legacy warningCount roughly in step for existing UI/analytics
    progress.warningCount = (progress.warningCount || 0) + docs.length;
    progress.riskScore = (progress.riskScore || 0) + addedRisk;
    const riskScore = progress.riskScore;

    // Dual-write legacy Violation docs so the existing violations dashboard
    // keeps working. warningNumber tracks position within legacy flags only.
    const legacyDocs = docs
      .filter((d) => LEGACY_VIOLATION_TYPES.has(d.type))
      .map((d, i) => ({
        userId: d.userId,
        contestId: d.contestId,
        type: d.type,
        warningNumber: progress.warningCount - docs.length + i + 1,
        details: d.details,
        timestamp: d.startedAt,
      }));
    if (legacyDocs.length > 0) {
      await Violation.insertMany(legacyDocs).catch((e) =>
        console.error("Legacy violation dual-write failed:", e)
      );
    }

    // ── Policy: soft warn, then terminate on threshold or catastrophic flag ──
    const shouldTerminate =
      riskScore >= RISK_TERMINATE_THRESHOLD || hasCatastrophic;
    const shouldWarn = !shouldTerminate && riskScore >= RISK_WARN_THRESHOLD;

    let terminated = false;
    if (shouldTerminate) {
      progress.status = "SUBMITTED";
      progress.submittedAt = new Date();
      progress.terminationReason = "MALPRACTICE";
      terminated = true;
    }

    await progress.save();

    // On termination, score the attempt server-side so the candidate still
    // lands on the leaderboard even if the client dies (mirrors violation path)
    if (terminated) {
      try {
        await scoreAttemptFromProgress(progress, {
          contestId,
          userId: user._id,
        });
      } catch (scoreErr) {
        console.error("Failed to score attempt on proctor termination:", scoreErr);
      }
    }

    return successResponse({
      riskScore,
      warn: shouldWarn,
      terminated,
      warnThreshold: RISK_WARN_THRESHOLD,
      terminateThreshold: RISK_TERMINATE_THRESHOLD,
      message: terminated
        ? "Contest terminated due to proctoring violations"
        : shouldWarn
          ? "Proctoring warning"
          : "Flags recorded",
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Proctor flag error:", error);
    return errorResponse("Server error recording flags", 500);
  }
}
