import { NextRequest } from "next/server";
import connectDB from "@/lib/db";
import ContestProgress from "@/lib/models/ContestProgress";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

type Params = { params: Promise<{ contestId: string }> };

const MAX_SNAPSHOT_SIZE = 1 * 1024 * 1024; // 1MB — a 640x480 JPEG is ~30-60KB

// POST /api/proctor/[contestId]/snapshot
// Stores a periodic webcam/screen snapshot as a private Cloudinary asset and
// returns its key so the client can attach it to a flag. Also updates the
// camera heartbeat (lastSnapshotAt) used to detect a dropped feed.
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_UPLOAD);
    if (limited) return limited;

    const user = await requireAuth(request);
    const { contestId } = await params;
    await connectDB();

    const progress = await ContestProgress.findOne({ contestId, userId: user._id });
    if (!progress) return errorResponse("Contest not started");
    if (progress.status === "SUBMITTED" || progress.status === "TIMED_OUT") {
      return errorResponse("Contest already submitted");
    }

    const formData = await request.formData();
    const snapshot = formData.get("snapshot") as File | null;
    const kind = (formData.get("kind") as string) || "webcam"; // webcam | screen

    if (!snapshot) return errorResponse("No snapshot provided", 400);
    if (!snapshot.type.startsWith("image/")) return errorResponse("Snapshot must be an image", 400);
    if (snapshot.size > MAX_SNAPSHOT_SIZE) return errorResponse("Snapshot too large", 400);
    if (!isCloudinaryConfigured()) return errorResponse("Media storage not configured", 503);

    const buffer = Buffer.from(await snapshot.arrayBuffer());
    const result = await uploadToCloudinary(buffer, `faktcheck/proctoring/${kind}`, {
      resourceType: "image",
      type: "authenticated", // private — signed URL only
      publicId: `${contestId}_${user._id}_${kind}_${Date.now()}`,
    });

    // Camera heartbeat — reviewers/cron can spot a dropped feed via the gap
    progress.mediaProctoring = progress.mediaProctoring || ({} as any);
    progress.mediaProctoring.cameraActive = true;
    progress.mediaProctoring.lastSnapshotAt = new Date();
    await progress.save();

    return successResponse({ evidenceKey: result.publicId });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    console.error("Proctor snapshot error:", error);
    return errorResponse("Server error storing snapshot", 500);
  }
}
