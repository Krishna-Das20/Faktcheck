import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
];

// POST /api/upload/image — Upload image (questions, avatars etc.)
export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, RATE_LIMIT_PRESETS.API_UPLOAD);
    if (limited) return limited;

    await requireAuth(request);

    if (!isCloudinaryConfigured()) {
      return errorResponse("Image upload is not configured. Set up Cloudinary credentials.", 503);
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    const type = (formData.get("type") as string) || "image"; // "image" or "file"

    if (!file) return errorResponse("Please upload a file", 400);

    const isFileUpload = type === "file";
    const maxSize = isFileUpload ? MAX_FILE_SIZE : MAX_IMAGE_SIZE;
    const allowedTypes = isFileUpload ? ALLOWED_FILE_TYPES : ALLOWED_IMAGE_TYPES;

    // Validate size
    if (file.size > maxSize) {
      return errorResponse("File too large. Max size is 5MB.", 400);
    }

    // Validate type
    if (!allowedTypes.includes(file.type)) {
      return errorResponse(
        `File type not allowed. Allowed: ${isFileUpload ? "images, PDFs, docs, etc." : "JPG, PNG, GIF, WebP"}`,
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith("image/");

    const folder = isFileUpload
      ? "faktcheck/announcements"
      : "faktcheck/questions";

    const result = await uploadToCloudinary(buffer, folder, {
      resourceType: isImage ? "image" : "raw",
      transformation: isImage
        ? [{ width: 1200, crop: "limit", quality: "auto" }]
        : undefined,
      publicId: isFileUpload
        ? `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}`
        : undefined,
    });

    return successResponse({
      imageUrl: result.url,
      url: result.url,
      publicId: result.publicId,
      fileName: file.name,
      fileType: isImage ? "image" : file.type === "application/pdf" ? "document" : "other",
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED") return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED") return errorResponse("Admin only", 403);
    console.error("Upload error:", error);
    return errorResponse("Upload failed", 500);
  }
}
