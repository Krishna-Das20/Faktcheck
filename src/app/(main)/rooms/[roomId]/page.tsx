"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { DoorOpen, Users, Trophy, Copy, Settings, ArrowLeft, Megaphone, Calendar, Send } from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ui/ImageUpload";

const inputStyle = { background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" };

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAnn, setNewAnn] = useState("");
  const [annAttachment, setAnnAttachment] = useState<{ url: string; publicId: string; fileName?: string; fileType?: string } | null>(null);
  const [tab, setTab] = useState<"overview" | "announcements" | "contests">("overview");

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [roomRes, annRes] = await Promise.all([
          fetch(`/api/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/rooms/${roomId}/announcements`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const rData = await roomRes.json();
        const aData = await annRes.json();
        setRoom(rData.room);
        setAnnouncements(aData.announcements || []);
      } catch { toast.error("Failed to load"); }
      setLoading(false);
    };
    fetch_();
  }, [roomId]);

  const isOwner = room?.owner?._id === user?._id || room?.owner === user?._id;

  const postAnnouncement = async () => {
    if (!newAnn.trim() && !annAttachment) return;
    try {
      const body: any = { content: newAnn, title: newAnn.slice(0, 60) || "Announcement" };
      if (annAttachment) {
        body.attachments = [{
          fileName: annAttachment.fileName || "attachment",
          fileUrl: annAttachment.url,
          fileType: annAttachment.fileType || "document",
          publicId: annAttachment.publicId,
        }];
      }
      const res = await fetch(`/api/rooms/${roomId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { toast.success("Posted!"); setNewAnn(""); setAnnAttachment(null); const d = await res.json(); setAnnouncements([d.announcement, ...announcements]); }
      else toast.error("Failed to post");
    } catch { toast.error("Failed to post"); }
  };

  const copyCode = () => { if (room?.shortCode) { navigator.clipboard.writeText(room.shortCode); toast.success("Code copied!"); } };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  if (!room) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>Room not found</div>;

  return (
    <div className="min-h-screen py-8" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => router.push("/rooms")} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /> Back</button>

        {/* Header */}
        <div className="rounded-xl p-6 mb-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <DoorOpen className="w-8 h-8" style={{ color: "#06B6D4" }} />
                <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{room.name}</h1>
              </div>
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{room.description || "No description"}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={copyCode} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono" style={{ background: "var(--background-secondary)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                {room.shortCode} <Copy className="w-4 h-4" />
              </button>
              {isOwner && (
                <button onClick={() => router.push(`/admin/rooms`)} className="p-2 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                  <Settings className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-6 mt-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>
            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {room.members?.length || 0} members</span>
            <span className="flex items-center gap-1"><Trophy className="w-4 h-4" /> {room.contests?.length || 0} contests</span>
            <span>Owner: {room.owner?.name || "Unknown"}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["overview", "announcements", "contests"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-lg text-sm font-semibold capitalize" style={{ background: tab === t ? "var(--primary)" : "var(--background-secondary)", color: tab === t ? "#fff" : "var(--foreground-secondary)" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--foreground)" }}>Members</h2>
            <div className="space-y-2">
              {(room.members || []).slice(0, 20).map((member: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{member.name || "Unknown"}</p>
                    <p className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{member.email}</p>
                  </div>
                  {(member._id === room.owner?._id || member._id === room.owner) && (
                    <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(234,179,8,0.2)", color: "#EAB308" }}>Owner</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        {tab === "announcements" && (
          <div className="space-y-4">
            {isOwner && (
              <div className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex gap-3">
                  <textarea value={newAnn} onChange={(e) => setNewAnn(e.target.value)} rows={2} className="flex-1 px-3 py-2 rounded-lg text-sm resize-none" style={inputStyle} placeholder="Post an announcement..." />
                  <button onClick={postAnnouncement} className="self-end px-4 py-2 rounded-xl text-white cursor-pointer" style={{ background: "var(--primary)" }}><Send className="w-5 h-5" /></button>
                </div>
                <div className="mt-3">
                  <ImageUpload
                    value={annAttachment?.url || null}
                    onChange={(data) => setAnnAttachment(data)}
                    type="file"
                    label="Attach file (optional)"
                  />
                </div>
              </div>
            )}
            {announcements.length === 0 ? (
              <div className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No announcements yet</div>
            ) : announcements.map((ann, i) => (
              <div key={i} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone className="w-4 h-4" style={{ color: "#EAB308" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{ann.postedBy?.name || "Admin"}</span>
                  <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{ann.content}</p>
                {ann.attachments?.map((att: any, j: number) => (
                  att.fileType === "image" ? (
                    <img key={j} src={att.fileUrl} alt={att.fileName} className="rounded-lg max-h-48 mt-2 object-contain" />
                  ) : (
                    <a key={j} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-sm underline" style={{ color: "var(--primary)" }}>
                      📎 {att.fileName || "Attachment"}
                    </a>
                  )
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Contests */}
        {tab === "contests" && (
          <div className="space-y-3">
            {(room.contests || []).length === 0 ? (
              <div className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No contests in this room yet</div>
            ) : (room.contests || []).map((c: any) => (
              <Link key={c._id} href={`/contest/${c._id}`} className="block rounded-xl p-5 transition-all hover:scale-[1.01]" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{c.title}</h3>
                    <p className="text-xs mt-1" style={{ color: "var(--foreground-secondary)" }}>
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(c.startTime).toLocaleDateString()} — {new Date(c.endTime).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold" style={{
                    background: new Date() < new Date(c.startTime) ? "rgba(59,130,246,0.2)" : new Date() <= new Date(c.endTime) ? "rgba(34,197,94,0.2)" : "rgba(107,114,128,0.2)",
                    color: new Date() < new Date(c.startTime) ? "#3B82F6" : new Date() <= new Date(c.endTime) ? "#22C55E" : "#9CA3AF",
                  }}>
                    {new Date() < new Date(c.startTime) ? "UPCOMING" : new Date() <= new Date(c.endTime) ? "LIVE" : "ENDED"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
