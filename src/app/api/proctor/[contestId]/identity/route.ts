import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

type Params = { params: Promise<{ contestId: string }> };

const MAX_PHOTO_SIZE = 3 * 1024 * 1024; // 3MB — a webcam still is small

// POST /api/proctor/[contestId]/identity
// Records the candidate's proctoring consent and (optionally) their identity
// photo. The photo is uploaded to Cloudinary as a private ("authenticated")
// asset — only reviewers with a signed URL can view it.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_UPLOAD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const progress = await ContestProgress.findOne({ contestId, userId: user._id });
    if (!progress) return errorResponse("Contest not started");

    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    const consent = formData.get("consent") === "true";

    if (!consent) {
      return errorResponse("Proctoring consent is required to continue", 400);
    }

    progress.mediaProctoring = progress.mediaProctoring || ({} as any);
    progress.mediaProctoring.consentGivenAt = new Date();

    if (photo) {
      if (!photo.type.startsWith("image/")) {
        return errorResponse("Identity photo must be an image", 400);
      }
      if (photo.size > MAX_PHOTO_SIZE) {
        return errorResponse("Identity photo too large (max 3MB)", 400);
      }
      if (!isCloudinaryConfigured()) {
        return errorResponse("Media proctoring storage is not configured", 503);
      }

      const buffer = Buffer.from(await photo.arrayBuffer());
      const result = await uploadToCloudinary(buffer, "faktcheck/proctoring/identity", {
        resourceType: "image",
        type: "authenticated", // private — signed URL only
        publicId: `${contestId}_${user._id}_identity`,
        transformation: [{ width: 640, crop: "limit", quality: "auto" }],
      });
      progress.mediaProctoring.identityPhotoKey = result.publicId;
    }

    await progress.save();

    return successResponse({ message: "Identity and consent recorded" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Proctor identity error:", error);
    return errorResponse("Server error recording identity", 500);
  }
}
