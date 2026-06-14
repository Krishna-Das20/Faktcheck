import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

// DELETE /api/upload/image/[publicId] — Delete image from Cloudinary
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_STANDARD);
    if (limited) return limited;

    await requireAdmin(request);
    const { publicId } = await params;

    if (!publicId) return errorResponse("Public ID is required", 400);

    // Cloudinary public IDs contain folder separators (/)
    // The route param only gives the last segment, so also check query
    const fullPublicId = request.nextUrl.searchParams.get("id") || publicId;

    await deleteFromCloudinary(decodeURIComponent(fullPublicId));

    return successResponse({ message: "Image deleted successfully" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Delete upload error:", error);
    return errorResponse("Error deleting image", 500);
  }
}
