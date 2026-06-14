import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Result from "@/lib/models/Result";
import Contest from "@/lib/models/Contest";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// POST /api/leaderboard/[contestId]/certificate — Generate certificate
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const result = await Result.findOne({ contestId, userId: user._id })
      .populate("contestId", "title")
      .populate("userId", "name email");

    if (!result) {
      return errorResponse("Result not found", 404);
    }

    if (result.status !== "SUBMITTED" && result.status !== "EVALUATED") {
      return errorResponse("Contest not completed yet", 400);
    }

    // Calculate rank — count how many users scored higher
    const totalParticipants = await Result.countDocuments({
      contestId,
      status: { $in: ["SUBMITTED", "EVALUATED"] },
    });

    const certificateData = {
      certificateId: `CERT-${contestId.slice(-6)}-${user._id.toString().slice(-6)}`,
      userName: (result.userId as any).name,
      contestTitle: (result.contestId as any).title,
      rank: result.rank || 0,
      score: result.totalScore,
      totalParticipants,
      issueDate: new Date().toLocaleDateString(),
      generatedAt: new Date().toISOString(),
      certificateUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.CLIENT_URL || ""}/certificate/${result._id}`,
    };

    // Update result with certificate info
    result.certificateGenerated = true;
    result.certificateUrl = certificateData.certificateUrl;
    await result.save();

    return successResponse({ certificate: certificateData });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    console.error("Generate certificate error:", error);
    return errorResponse("Server error generating certificate", 500);
  }
}
