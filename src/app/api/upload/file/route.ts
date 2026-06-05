import { NextRequest } from "next/server";
import { requireAdminOrOrganiser } from "@/lib/api-auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { uploadToCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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

// POST /api/upload/file — Upload file (announcements, attachments)
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrOrganiser(request);

    if (!isCloudinaryConfigured()) {
      return errorResponse(
        "File upload is not configured. Set up Cloudinary credentials.",
        503
      );
    }

    const formData = await request.formData();
    const file = (formData.get("file") as File) || (formData.get("image") as File);

    if (!file) return errorResponse("Please upload a file", 400);

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("File too large. Max size is 10MB.", 400);
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return errorResponse(
        "File type not allowed. Allowed: images, PDFs, docs, spreadsheets, presentations, text, zip.",
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith("image/");

    const result = await uploadToCloudinary(buffer, "faktcheck/announcements", {
      resourceType: isImage ? "image" : "raw",
      transformation: isImage
        ? [{ width: 1200, crop: "limit", quality: "auto" }]
        : undefined,
      publicId: `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}`,
    });

    return successResponse({
      url: result.url,
      publicId: result.publicId,
      fileName: file.name,
      fileType: isImage
        ? "image"
        : file.type === "application/pdf"
          ? "document"
          : "other",
    });
  } catch (error: any) {
    if (error.message === "NOT_AUTHENTICATED")
      return errorResponse("Not authorized", 401);
    if (error.message === "NOT_AUTHORIZED")
      return errorResponse("Admin/Organiser only", 403);
    console.error("File upload error:", error);
    return errorResponse("Upload failed", 500);
  }
}
