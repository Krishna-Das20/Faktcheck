"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import { Save, X, Plus, Trash2, Clock, Timer, DoorOpen } from "lucide-react";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

interface SectionConfig {
  enabled: boolean;
  hasTimer: boolean;
  duration: number;
  proctored: boolean;
}

export default function CreateContestPage() {
  return (
    <Suspense fallback={<div className="page-shell"><div className="max-w-4xl mx-auto px-4 py-12 text-center text-muted-ui">Loading...</div></div>}>
      <CreateContestContent />
    </Suspense>
  );
}

function CreateContestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get("roomId") || "";
  const { user, token, isAdmin, isAdminOrOrganiser } = useAuth();

  const [formData, setFormData] = useState({
    title: "", description: "", startTime: "", endTime: "",
    maxParticipants: "",
    roomId: preselectedRoomId,
    sections: {
      mcq: { enabled: true, hasTimer: false, duration: 30, proctored: true } as SectionConfig,
      coding: { enabled: true, hasTimer: false, duration: 120, proctored: true } as SectionConfig,
      forms: { enabled: false, hasTimer: false, duration: 0, proctored: false } as SectionConfig,
    },
    rules: ["No cheating allowed", "Complete all questions within time limit"],
    prizes: ["1st Prize: Certificate + Goodies", "2nd Prize: Certificate", "3rd Prize: Certificate"],
    isPublished: false,
  });
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);


  useEffect(() => {
    if (user?.role === "ORGANISER" || user?.role === "ADMIN") {
      fetchRooms();
    }
  }, [user]);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch("/api/rooms", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const allRooms = data.rooms || [];

      if (user?.role === "ADMIN") {
        setRooms(allRooms);
      } else {
        // Organiser sees only rooms they own or co-organise
        const userId = user?._id?.toString?.() || user?._id;
        const manageableRooms = allRooms.filter((room: any) => {
          const ownerId = room.owner?._id?.toString?.() || room.owner?._id || room.owner;
          const isOwner = ownerId === userId;
          const isCoOrg = room.coOrganisers?.some((co: any) => ((co._id?.toString?.() || co._id || co) === userId));
          return isOwner || isCoOrg;
        });
        setRooms(manageableRooms);
      }
    } catch {
      console.error("Failed to fetch rooms");
    } finally {
      setLoadingRooms(false);
    }
  };



  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, type } = e.target;
    const value = type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;

    if (name.includes(".")) {
      const parts = name.split(".");
      setFormData((prev) => {
        const updated = { ...prev };
        if (parts.length === 3) {
          (updated as any)[parts[0]] = {
            ...(updated as any)[parts[0]],
            [parts[1]]: { ...(updated as any)[parts[0]][parts[1]], [parts[2]]: value },
          };
        }
        return updated;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleArrayChange = (field: "rules" | "prizes", index: number, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: prev[field].map((item, i) => (i === index ? value : item)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) { toast.error("Title is required"); return; }
    if (!formData.startTime || !formData.endTime) { toast.error("Start and end time required"); return; }
    if (new Date(formData.startTime) >= new Date(formData.endTime)) { toast.error("End time must be after start"); return; }
    if (!formData.sections.mcq.enabled && !formData.sections.coding.enabled && !formData.sections.forms.enabled) { toast.error("Enable at least one section"); return; }

    setLoading(true);
    try {
      // Auto-compute duration from start/end times (in minutes)
      const durationMs = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
      const durationMins = Math.round(durationMs / 60000);

      const body: any = {
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        duration: durationMins,
        maxParticipants: formData.maxParticipants ? Number(formData.maxParticipants) : undefined,
        roomId: formData.roomId || undefined,
        sections: {
          mcq: { ...formData.sections.mcq, duration: formData.sections.mcq.hasTimer ? Number(formData.sections.mcq.duration) : 0, totalMarks: 0 },
          coding: { ...formData.sections.coding, duration: formData.sections.coding.hasTimer ? Number(formData.sections.coding.duration) : 0, totalMarks: 0 },
          forms: { ...formData.sections.forms, duration: 0, totalMarks: 0 },
        },
        rules: formData.rules.filter((r) => r.trim()),
        prizes: formData.prizes.filter((p) => p.trim()),
      };

      const res = await fetch("/api/contests", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        const msg = isAdmin ? "Contest created!" : "Contest created & submitted for approval!";
        toast.success(msg);
        router.push("/admin/dashboard");
      } else toast.error(data.message || "Failed to create");
    } catch { toast.error("Failed to create contest"); }
    setLoading(false);
  };

  const SectionBlock = ({ name, label }: { name: string; label: string }) => {
    const section = (formData.sections as any)[name] as SectionConfig;
    return (
      <div className="p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
        {/* Enable section */}
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" name={`sections.${name}.enabled`} checked={section.enabled} onChange={handleChange} className="w-5 h-5 rounded" />
          <span className="text-lg font-semibold text-strong">{label}</span>
        </label>
        {section.enabled && (
          <div className="space-y-3 ml-7">
            {/* Timer toggle */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name={`sections.${name}.hasTimer`} checked={section.hasTimer} onChange={handleChange} className="w-4 h-4 rounded" />
                <Timer className="w-4 h-4" style={{ color: section.hasTimer ? "var(--primary)" : "var(--foreground-secondary)" }} />
                <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Enable Timer</span>
              </label>
              {section.hasTimer && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name={`sections.${name}.duration`}
                    value={section.duration}
                    onChange={handleChange}
                    className="w-20 px-3 py-1.5 rounded-lg text-sm text-center"
                    style={inputStyle}
                    min="1"
                  />
                  <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>minutes</span>
                </div>
              )}
            </div>

            {/* Proctoring toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name={`sections.${name}.proctored`} checked={section.proctored} onChange={handleChange} className="w-4 h-4 rounded" />
              <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Enable Proctoring</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-shell" >
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-2 text-strong">Create New Contest</h1>
            <p style={{ color: "var(--foreground-secondary)" }}>Fill in the details to create a new contest</p>
          </div>
          <button onClick={() => router.push("/admin/dashboard")} className="flex items-center px-4 py-2 rounded-lg" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
            <X className="w-5 h-5 mr-2" /> Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold text-strong">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Contest Title *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} placeholder="e.g., Weekly Coding Challenge #1" required />
            </div>

            {/* Room Selector */}
            {(user?.role === "ORGANISER" || user?.role === "ADMIN") && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>
                  <DoorOpen className="inline w-4 h-4 mr-1" />
                  Room (Optional)
                </label>
                {loadingRooms ? (
                  <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Loading rooms...</p>
                ) : rooms.length > 0 ? (
                  <>
                    <select
                      name="roomId"
                      value={formData.roomId}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-lg"
                      style={inputStyle}
                      disabled={!!preselectedRoomId}
                    >
                      <option value="">Public Contest (No Room)</option>
                      {rooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.name} ({room.shortCode}) {user?.role === "ADMIN" && room.owner?.name ? `- by ${room.owner.name}` : ""}
                        </option>
                      ))}
                    </select>
                    {formData.roomId && (
                      <p className="text-xs mt-1" style={{ color: "var(--primary)" }}>
                        This contest will be visible only to room members and auto-approved
                      </p>
                    )}
                  </>
                ) : (
                  <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
                    <p className="text-sm mb-2" style={{ color: "var(--foreground-secondary)" }}>
                      No rooms available. Create a room to host private contests.
                    </p>
                    <Link href="/rooms/create" className="text-sm" style={{ color: "var(--primary)" }}>
                      + Create a Room
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full px-3 py-2.5 rounded-lg resize-none" style={inputStyle} placeholder="Describe what this contest is about..." required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Start Time *</label>
                <input type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>End Time *</label>
                <input type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Max Participants (optional)</label>
              <input type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} placeholder="Leave empty for unlimited" min="1" />
            </div>
          </div>

          {/* Sections */}
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold text-strong">Contest Sections</h2>
            <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Enable sections and optionally set a timer for each. Timer will enforce a countdown within that section.</p>
            <SectionBlock name="mcq" label="MCQ Section" />
            <SectionBlock name="coding" label="Coding Section" />
            <SectionBlock name="forms" label="Custom Forms Section" />
          </div>

          {/* Rules */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-strong">Contest Rules</h2>
              <button type="button" onClick={() => setFormData((p) => ({ ...p, rules: [...p.rules, ""] }))} className="flex items-center px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                <Plus className="w-4 h-4 mr-1" /> Add Rule
              </button>
            </div>
            <div className="space-y-3">
              {formData.rules.map((rule, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={rule} onChange={(e) => handleArrayChange("rules", i, e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder={`Rule ${i + 1}`} />
                  <button type="button" onClick={() => setFormData((p) => ({ ...p, rules: p.rules.filter((_, j) => j !== i) }))} className="p-2 rounded-lg"><Trash2 className="w-5 h-5" style={{ color: "#EF4444" }} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Prizes */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-strong">Prizes</h2>
              <button type="button" onClick={() => setFormData((p) => ({ ...p, prizes: [...p.prizes, ""] }))} className="flex items-center px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                <Plus className="w-4 h-4 mr-1" /> Add Prize
              </button>
            </div>
            <div className="space-y-3">
              {formData.prizes.map((prize, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={prize} onChange={(e) => handleArrayChange("prizes", i, e.target.value)} className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} placeholder={`Prize ${i + 1}`} />
                  <button type="button" onClick={() => setFormData((p) => ({ ...p, prizes: p.prizes.filter((_, j) => j !== i) }))} className="p-2 rounded-lg"><Trash2 className="w-5 h-5" style={{ color: "#EF4444" }} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Publish */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="isPublished" checked={formData.isPublished} onChange={handleChange} className="w-5 h-5 rounded" />
              <div>
                <p className="font-semibold text-strong">Publish Contest</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                  {isAdmin ? "Make this contest visible to users immediately" : "Submit for admin approval before it goes live"}
                </p>
              </div>
            </label>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => router.push("/admin/dashboard")} className="px-6 py-3 rounded-xl" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
              {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Creating...</> : <><Save className="w-5 h-5 mr-2" />Create Contest</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
