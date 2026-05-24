"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface UploadResult {
  url: string;
  publicId: string;
  fileName?: string;
  fileType?: string;
}

interface ImageUploadProps {
  /** Current image URL */
  value?: string | null;
  /** Called with { url, publicId, fileName, fileType } on successful upload, or null on remove */
  onChange: (data: UploadResult | null) => void;
  /** Upload type: "image" for questions, "file" for announcements */
  type?: "image" | "file";
  /** Label text */
  label?: string;
  /** Optional class name for the container */
  className?: string;
  /** Compact mode — smaller drop zone for inline use (e.g. MCQ options) */
  compact?: boolean;
}

export default function ImageUpload({
  value,
  onChange,
  type = "image",
  label = "Upload Image",
  className = "",
  compact = false,
}: ImageUploadProps) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [currentPublicId, setCurrentPublicId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      // Client-side validation
      const maxSize = type === "file" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File too large. Max ${type === "file" ? "10MB" : "5MB"}.`);
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("type", type);

        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          setCurrentPublicId(data.publicId);
          onChange({
            url: data.imageUrl || data.url,
            publicId: data.publicId,
            fileName: data.fileName || file.name,
            fileType: data.fileType || (file.type.startsWith("image/") ? "image" : "document"),
          });
          toast.success("Uploaded successfully!");
        } else {
          toast.error(data.message || "Upload failed");
        }
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [token, type, onChange]
  );

  // Fix #4: Clean up orphaned Cloudinary images on remove
  const handleRemove = useCallback(async () => {
    // Fire-and-forget deletion (don't block UI)
    if (currentPublicId && token) {
      fetch(`/api/upload/image/cleanup?id=${encodeURIComponent(currentPublicId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {}); // best-effort cleanup
    }
    setCurrentPublicId(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [onChange, currentPublicId, token]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) {
        handleUpload(e.dataTransfer.files[0]);
      }
    },
    [handleUpload]
  );

  return (
    <div className={className}>
      <label
        className="block text-sm font-medium mb-2"
        style={{ color: "var(--foreground-secondary)" }}
      >
        {label}
      </label>

      {value ? (
        /* ───── Preview ───── */
        <div
          className={`relative rounded-xl overflow-hidden ${compact ? "inline-block" : ""}`}
          style={{
            background: "var(--background-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <img
            src={value}
            alt="Uploaded"
            className={compact ? "max-h-24 object-contain" : "w-full max-h-64 object-contain"}
            style={{ background: "var(--background)" }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 rounded-full cursor-pointer transition-transform hover:scale-110"
            style={{
              background: "rgba(239,68,68,0.9)",
              color: "white",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* ───── Upload zone ───── */
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl text-center cursor-pointer transition-all ${compact ? "p-3" : "p-6"}`}
          style={{
            background: dragActive
              ? "rgba(255,107,53,0.08)"
              : "var(--background-secondary)",
            border: dragActive
              ? "2px dashed var(--primary)"
              : "2px dashed var(--border)",
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2
                className={`animate-spin ${compact ? "w-5 h-5" : "w-8 h-8"}`}
                style={{ color: "var(--primary)" }}
              />
              {!compact && (
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                  Uploading...
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {dragActive ? (
                <Upload className={`${compact ? "w-5 h-5" : "w-8 h-8"}`} style={{ color: "var(--primary)" }} />
              ) : (
                <ImageIcon
                  className={`${compact ? "w-5 h-5" : "w-8 h-8"}`}
                  style={{ color: "var(--foreground-secondary)" }}
                />
              )}
              {!compact && (
                <>
                  <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                    <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                      Click to upload
                    </span>{" "}
                    or drag and drop
                  </p>
                  <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                    {type === "file"
                      ? "Images, PDFs, Docs (max 10MB)"
                      : "JPG, PNG, GIF, WebP (max 5MB)"}
                  </p>
                </>
              )}
              {compact && (
                <p className="text-xs" style={{ color: "var(--primary)" }}>Upload</p>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={
              type === "file"
                ? "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                : "image/jpeg,image/png,image/gif,image/webp"
            }
            onChange={(e) => {
              if (e.target.files?.[0]) handleUpload(e.target.files[0]);
            }}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
