"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { ArrowLeft, Users, FileText } from "lucide-react";
import Link from "next/link";

export default function CreateRoomPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Room name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        toast.success("Room created successfully!");
        router.push(`/rooms/${data.room?._id}`);
      } else toast.error(data.message || "Failed to create room");
    } catch {
      toast.error("Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 text-muted-ui hover:text-strong mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to My Rooms
        </Link>

        {/* Form Card */}
        <div className="card">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="p-4 rounded-xl"
              style={{ background: "linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-400)))" }}
            >
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-strong">Create a New Room</h1>
              <p className="text-muted-ui">Set up a private space for your contests</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Room Name */}
            <div>
              <label className="block text-sm font-medium text-soft-ui mb-2">
                Room Name *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-soft-ui" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., DSA Practice Group"
                  className="input-field w-full pl-10"
                  maxLength={100}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-soft-ui mb-2">
                Description (optional)
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-soft-ui" />
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Briefly describe the purpose of this room..."
                  className="input-field w-full pl-10 min-h-[100px] resize-none"
                  maxLength={500}
                  rows={4}
                />
              </div>
              <p className="text-xs text-soft-ui mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* Info Box */}
            <div className="rounded-lg p-4">
              <h4 className="font-medium mb-2" style={{ color: "rgb(var(--color-accent-400))" }}>What happens next?</h4>
              <ul className="text-sm text-muted-ui space-y-1">
                <li>• A unique room code will be generated</li>
                <li>• Share the code or link with participants</li>
                <li>• Create contests that are visible only to room members</li>
                <li>• Room contests are auto-approved (no admin verification needed)</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Link href="/rooms" className="btn-secondary flex-1 text-center">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Room"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
