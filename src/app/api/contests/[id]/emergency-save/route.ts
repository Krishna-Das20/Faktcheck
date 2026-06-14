import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

// POST /api/contests/[id]/emergency-save — uses token in body (for beforeunload/sendBeacon)
// Accepts both mcqAnswers and codingDrafts for maximum data preservation
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const { id } = await params;
    const { mcqAnswers, codingDrafts, token } = await request.json();

    if (!token) return errorResponse("No token provided", 401);

    // Verify token manually (not from header — sendBeacon can't set headers)
    let decoded;
    try {
      decoded = await verifyToken(token);
    } catch {
      return errorResponse("Invalid token", 401);
    }

    await connectDB();
    const progress = await ContestProgress.findOne({ contestId: id, userId: decoded.userId });

    if (!progress || progress.status === "SUBMITTED") {
      return successResponse({ message: "No save needed" });
    }

    let saved = false;

    // Save MCQ answers
    if (mcqAnswers?.length > 0) {
      progress.mcqProgress.answers = mcqAnswers;
      saved = true;
    }

    // Save coding drafts (code + language per problem)
    // These are stored as a lightweight array on codingProgress for recovery
    if (codingDrafts?.length > 0) {
      // Store drafts in a way that doesn't conflict with existing schema
      // We use the existing problemTimes array and add draft data, or store separately
      // For safety, store as a JSON string in a flexible field
      (progress.codingProgress as any).drafts = codingDrafts;
      progress.markModified("codingProgress");
      saved = true;
    }

    if (saved) {
      await progress.save();
    }

    return successResponse({ message: "Emergency save successful" });
  } catch (error) {
    console.error("Emergency save error:", error);
    return errorResponse("Emergency save failed", 500);
  }
}

