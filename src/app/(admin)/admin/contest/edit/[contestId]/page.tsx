"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Save, X, Plus, Trash2, Timer } from "lucide-react";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

interface SectionConfig { enabled: boolean; hasTimer: boolean; duration: number; proctored: boolean; }

export default function EditContestPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const loadContest = async () => {
      try {
        const res = await fetch(`/api/contests/${contestId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        const c = data.contest;
        const fmt = (d: string) => new Date(d).toISOString().slice(0, 16);
        setFormData({
          title: c.title, description: c.description,
          startTime: fmt(c.startTime), endTime: fmt(c.endTime),
          duration: c.duration || 120, // loaded from DB for reference but not editable
          maxParticipants: c.maxParticipants || "",
          sections: {
            mcq: { enabled: c.sections?.mcq?.enabled ?? false, hasTimer: c.sections?.mcq?.hasTimer ?? (c.sections?.mcq?.duration > 0), duration: c.sections?.mcq?.duration ?? 30, proctored: c.sections?.mcq?.proctored ?? true },
            coding: { enabled: c.sections?.coding?.enabled ?? false, hasTimer: c.sections?.coding?.hasTimer ?? (c.sections?.coding?.duration > 0), duration: c.sections?.coding?.duration ?? 120, proctored: c.sections?.coding?.proctored ?? true },
            forms: { enabled: c.sections?.forms?.enabled ?? false, hasTimer: false, duration: 0, proctored: c.sections?.forms?.proctored ?? false },
          },
          rules: c.rules || [], prizes: c.prizes || [], isPublished: c.isPublished,
          mediaProctoring: {
            enabled: c.mediaProctoring?.enabled ?? false,
            requireCamera: c.mediaProctoring?.requireCamera ?? true,
            requireScreen: c.mediaProctoring?.requireScreen ?? false,
            requireIdentityPhoto: c.mediaProctoring?.requireIdentityPhoto ?? true,
            recordSnapshots: c.mediaProctoring?.recordSnapshots ?? true,
            detectAudio: c.mediaProctoring?.detectAudio ?? false,
          },
        });
      } catch { toast.error("Failed to load contest"); router.push("/admin/dashboard"); }
      setLoading(false);
    };
    loadContest();
  }, [contestId]);



  if (loading || !formData) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, type } = e.target;
    const value = type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;

    if (name.includes(".")) {
      const parts = name.split(".");
      setFormData((prev: any) => {
        const updated = { ...prev };
        if (parts.length === 3) {
          updated[parts[0]] = { ...updated[parts[0]], [parts[1]]: { ...updated[parts[0]][parts[1]], [parts[2]]: value } };
        } else if (parts.length === 2) {
          updated[parts[0]] = { ...updated[parts[0]], [parts[1]]: value };
        }
        return updated;
      });
    } else {
      setFormData((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Auto-compute duration from start/end times (in minutes)
      const durationMs = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
      const durationMins = Math.round(durationMs / 60000);

      const body = {
        ...formData,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        duration: durationMins,
        maxParticipants: formData.maxParticipants ? Number(formData.maxParticipants) : undefined,
        sections: {
          mcq: { ...formData.sections.mcq, duration: formData.sections.mcq.hasTimer ? Number(formData.sections.mcq.duration) : 0, totalMarks: 0 },
          coding: { ...formData.sections.coding, duration: formData.sections.coding.hasTimer ? Number(formData.sections.coding.duration) : 0, totalMarks: 0 },
          forms: { ...formData.sections.forms, duration: 0, totalMarks: 0 },
        },
        rules: formData.rules.filter((r: string) => r.trim()),
        prizes: formData.prizes.filter((p: string) => p.trim()),
      };
      const res = await fetch(`/api/contests/${contestId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success || res.ok) { toast.success("Contest updated!"); router.push("/admin/dashboard"); }
      else toast.error(data.message || "Failed to update");
    } catch { toast.error("Failed to update contest"); }
    setSaving(false);
  };

  const SectionBlock = ({ name, label }: { name: string; label: string }) => {
    const section = formData.sections[name] as SectionConfig;
    return (
      <div className="p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" name={`sections.${name}.enabled`} checked={section.enabled} onChange={handleChange} className="w-5 h-5 rounded" />
          <span className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{label}</span>
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
                  <input type="number" name={`sections.${name}.duration`} value={section.duration} onChange={handleChange} className="w-20 px-3 py-1.5 rounded-lg text-sm text-center" style={inputStyle} min="1" />
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
    <div className="page-shell">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>Edit Contest</h1>
            <p style={{ color: "var(--foreground-secondary)" }}>Update contest details</p>
          </div>
          <button onClick={() => router.push("/admin/dashboard")} className="flex items-center px-4 py-2 rounded-lg" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
            <X className="w-5 h-5 mr-2" /> Cancel
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Basic Information</h2>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Contest Title *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--foreground-secondary)" }}>Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full px-3 py-2.5 rounded-lg resize-none" style={inputStyle} required />
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
              <input type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} className="w-full px-3 py-2.5 rounded-lg" style={inputStyle} placeholder="Leave empty for unlimited" />
            </div>
          </div>

          {/* Sections */}
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Contest Sections</h2>
            <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Enable sections and optionally set a timer for each.</p>
            <SectionBlock name="mcq" label="MCQ Section" />
            <SectionBlock name="coding" label="Coding Section" />
            <SectionBlock name="forms" label="Custom Forms Section" />
          </div>

          {/* Media Proctoring */}
          <div className="rounded-xl p-6 space-y-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Advanced Proctoring (Camera / Screen)</h2>
              <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
                Adds a pre-exam system check, consent, identity capture, and on-device camera
                monitoring for proctored sections. Requires Cloudinary storage.
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="mediaProctoring.enabled" checked={formData.mediaProctoring?.enabled || false} onChange={handleChange} className="w-5 h-5 rounded" />
              <span className="font-medium" style={{ color: "var(--foreground)" }}>Enable advanced proctoring</span>
            </label>
            {formData.mediaProctoring?.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2" style={{ borderLeft: "2px solid var(--border)" }}>
                {([
                  ["requireCamera", "Require camera"],
                  ["requireIdentityPhoto", "Capture identity photo"],
                  ["recordSnapshots", "Store webcam snapshots"],
                  ["detectAudio", "Detect background voices"],
                  ["requireScreen", "Require screen sharing"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer text-sm">
                    <input type="checkbox" name={`mediaProctoring.${key}`} checked={formData.mediaProctoring?.[key] || false} onChange={handleChange} className="w-4 h-4 rounded" />
                    <span style={{ color: "var(--foreground)" }}>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Rules */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Rules</h2>
              <button type="button" onClick={() => setFormData((p: any) => ({ ...p, rules: [...p.rules, ""] }))} className="flex items-center px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}><Plus className="w-4 h-4 mr-1" /> Add</button>
            </div>
            {formData.rules.map((rule: string, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" value={rule} onChange={(e) => setFormData((p: any) => ({ ...p, rules: p.rules.map((r: string, j: number) => j === i ? e.target.value : r) }))} className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                <button type="button" onClick={() => setFormData((p: any) => ({ ...p, rules: p.rules.filter((_: string, j: number) => j !== i) }))} className="p-2"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
              </div>
            ))}
          </div>

          {/* Prizes */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Prizes</h2>
              <button type="button" onClick={() => setFormData((p: any) => ({ ...p, prizes: [...p.prizes, ""] }))} className="flex items-center px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}><Plus className="w-4 h-4 mr-1" /> Add</button>
            </div>
            {formData.prizes.map((prize: string, i: number) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" value={prize} onChange={(e) => setFormData((p: any) => ({ ...p, prizes: p.prizes.map((r: string, j: number) => j === i ? e.target.value : r) }))} className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                <button type="button" onClick={() => setFormData((p: any) => ({ ...p, prizes: p.prizes.filter((_: string, j: number) => j !== i) }))} className="p-2"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
              </div>
            ))}
          </div>

          {/* Publish */}
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="isPublished" checked={formData.isPublished} onChange={handleChange} className="w-5 h-5 rounded" />
              <div>
                <p className="font-semibold" style={{ color: "var(--foreground)" }}>Publish Contest</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Make visible to users</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => router.push("/admin/dashboard")} className="px-6 py-3 rounded-xl" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
              {saving ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Saving...</> : <><Save className="w-5 h-5 mr-2" />Update Contest</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
