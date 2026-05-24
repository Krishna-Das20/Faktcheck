import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary (lazy — only when first needed)
let configured = false;

function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a file buffer to Cloudinary.
 * @param buffer - File buffer (from FormData)
 * @param folder - Cloudinary folder path
 * @param options - Additional upload options
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  options: {
    resourceType?: "image" | "raw" | "auto";
    transformation?: any[];
    publicId?: string;
  } = {}
): Promise<{ url: string; publicId: string }> {
  ensureConfigured();

  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      folder,
      resource_type: options.resourceType || "image",
    };

    if (options.transformation) {
      uploadOptions.transformation = options.transformation;
    }
    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error || !result) return reject(error || new Error("Upload returned no result"));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by its public ID.
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "raw" = "image"
): Promise<void> {
  if (!isCloudinaryConfigured() || !publicId) return;
  ensureConfigured();

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
}

export default cloudinary;
