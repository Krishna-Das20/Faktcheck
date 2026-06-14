import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/api-auth";
import { errorResponse } from "@/lib/api-utils";

// GET /api/upload/status — Check if Cloudinary is configured
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const isConfigured = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      cloudName: isConfigured ? process.env.CLOUDINARY_CLOUD_NAME : null,
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    return errorResponse("Admin only", 403);
  }
}
