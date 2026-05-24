import { NextRequest } from "next/server";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { deleteFromCloudinary } from "@/lib/cloudinary";

/**
 * DELETE /api/upload/image/cleanup?id=<publicId>
 * Best-effort cleanup for orphaned Cloudinary images (e.g., when user removes an upload before saving).
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrOrganiser(request);
    const publicId = request.nextUrl.searchParams.get("id");

    if (!publicId) return errorResponse("Public ID is required", 400);

    // Decode in case it was double-encoded
    const decodedId = decodeURIComponent(publicId);
    await deleteFromCloudinary(decodedId);

    return successResponse({ message: "Cleanup successful" });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin/Organiser only", 403);
    console.error("Cleanup error:", error);
    return errorResponse("Cleanup failed", 500);
  }
}
