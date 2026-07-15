"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Plus, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ImageItem {
  url: string;
  publicId: string;
}

interface MultiImageUploadProps {
  /** Current images array */
  images: ImageItem[];
  /** Called with updated images array */
  onChange: (images: ImageItem[]) => void;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Label text */
  label?: string;
  /** Optional class name */
  className?: string;
}

export default function MultiImageUpload({
  images = [],
  onChange,
  maxImages = 5,
  label = "Question Images (optional)",
  className = "",
}: MultiImageUploadProps) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error("File too large. Max size is 5MB.");
        return;
      }

      if (images.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed.`);
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("type", "image");

        const res = await fetch("/api/upload/image", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          onChange([...images, { url: data.imageUrl || data.url, publicId: data.publicId }]);
          toast.success("Image uploaded!");
        } else {
          toast.error(data.message || "Upload failed");
        }
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [token, images, onChange, maxImages]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const img = images[index];
      // Fire-and-forget cleanup
      if (img.publicId && token) {
        fetch(`/api/upload/image/cleanup?id=${encodeURIComponent(img.publicId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange, token]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleUpload(e.dataTransfer.files[0]);
    },
    [handleUpload]
  );

  return (
    <div className={className}>
      <label
        className="flex items-center gap-2 text-sm font-medium mb-2"
        style={{ color: "var(--foreground-secondary)" }}
      >
        <ImageIcon className="w-4 h-4" />
        {label}
        <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
          ({images.length}/{maxImages})
        </span>
      </label>

      {/* Image gallery */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((img, i) => (
            <div
              key={img.publicId || i}
              className="relative rounded-xl overflow-hidden group"
              style={{
                background: "var(--background-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <img
                src={img.url}
                alt={`Image ${i + 1}`}
                className="h-28 w-auto max-w-[200px] object-contain"
                style={{ background: "var(--background)" }}
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full cursor-pointer transition-transform hover:scale-110"
                style={{ background: "rgba(239,68,68,0.9)", color: "white" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {images.length < maxImages && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl text-center cursor-pointer transition-all p-4"
          style={{
            background: dragActive ? "rgba(255,107,53,0.08)" : "var(--background-secondary)",
            border: dragActive ? "2px dashed var(--primary)" : "2px dashed var(--border)",
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                Uploading...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5" style={{ color: "var(--primary)" }} />
                <ImageIcon className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>Click to upload</span>{" "}
                or drag and drop
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                JPG, PNG, GIF, WebP (max 5MB)
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
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
