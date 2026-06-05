import { NextResponse } from "next/server";

// GET /api/upload/status — Check if Cloudinary is configured
export async function GET() {
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
}
