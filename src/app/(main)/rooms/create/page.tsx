"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, Save, ArrowLeft } from "lucide-react";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

export default function CreateRoomPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", description: "", isPublic: true });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Room name required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        toast.success("Room created!");
        router.push(`/rooms/${data.room?._id}`);
      } else toast.error(data.message || "Failed to create");
    } catch { toast.error("Failed to create room"); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen py-8" style={{ background: "var(--background)" }}>
      <div className="max-w-2xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /> Back</button>
        <div className="flex items-center gap-3 mb-8">
          <DoorOpen className="w-8 h-8" style={{ color: "#06B6D4" }} />
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Create Room</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Room Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} placeholder="e.g., CS Department 2024" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full px-3 py-2.5 rounded-lg resize-none" style={inputStyle} placeholder="Describe the purpose of this room..." />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="w-5 h-5 rounded" />
              <div>
                <p className="font-semibold" style={{ color: "var(--foreground)" }}>Public Room</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Anyone with the code can join</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
              {saving ? "Creating..." : <><Save className="w-5 h-5" /> Create Room</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
