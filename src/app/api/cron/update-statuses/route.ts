import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import Contest from "@/lib/models/Contest";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/cron/update-statuses — Cron job to update contest statuses
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sets this header)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse("Unauthorized", 401);
    }

    await connectDB();
    const now = new Date();

    // Update UPCOMING → LIVE
    const toLive = await Contest.updateMany(
      { status: "UPCOMING", startTime: { $lte: now }, endTime: { $gt: now } },
      { $set: { status: "LIVE" } }
    );

    // Update LIVE → ENDED
    const toEnded = await Contest.updateMany(
      { status: "LIVE", endTime: { $lte: now } },
      { $set: { status: "ENDED" } }
    );

    // Also catch any UPCOMING that should be ENDED (if cron missed a cycle)
    const skippedToEnded = await Contest.updateMany(
      { status: "UPCOMING", endTime: { $lte: now } },
      { $set: { status: "ENDED" } }
    );

    return successResponse({
      message: "Contest statuses updated",
      updates: {
        toLive: toLive.modifiedCount,
        toEnded: toEnded.modifiedCount + skippedToEnded.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error("Cron update-statuses error:", error);
    return errorResponse("Server error", 500);
  }
}
