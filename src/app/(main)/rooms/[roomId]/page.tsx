"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  Users, Copy, ArrowLeft, Plus, UserPlus,
  Crown, Shield, User, LogOut, Trash2, Link2,
  Megaphone, Pin, Edit2, Paperclip, X, FileText, Download,
  Calendar, Clock, Award,
} from "lucide-react";
import Link from "next/link";
import Loader from "@/components/common/Loader";

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuth();
  const router = useRouter();

  const [room, setRoom] = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("contests");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const userId = user?._id?.toString() || user?._id;
  const ownerId = room?.owner?._id?.toString() || room?.owner?._id;
  const isAdmin = user?.role === "ADMIN";
  const isOwner = ownerId === userId;
  const isCoOrganiser = room?.coOrganisers?.some((co: any) => (co._id?.toString() || co._id) === userId);
  const isOrganiser = isOwner || isCoOrganiser || isAdmin;
  const canRemoveMembers = isOwner || isAdmin;

  useEffect(() => {
    fetchRoomDetails();
  }, [roomId, token]);

  const fetchRoomDetails = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success !== false && data.room) {
        setRoom(data.room);
        setContests(data.contests || []);
      } else {
        toast.error(data.message || "Failed to fetch room");
        router.push("/rooms");
      }
    } catch {
      toast.error("Failed to fetch room details");
      router.push("/rooms");
    } finally {
      setLoading(false);
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/rooms/join/${room.shortCode}`;
    navigator.clipboard.writeText(link);
    toast.success("Join link copied to clipboard!");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.shortCode);
    toast.success("Room code copied!");
  };

  const handleInviteCoOrganiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Co-organiser invited successfully!");
        setInviteEmail("");
        setShowInviteModal(false);
        fetchRoomDetails();
      } else toast.error(data.message || "Failed to invite");
    } catch { toast.error("Failed to invite"); }
    setInviting(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Member removed"); fetchRoomDetails(); }
      else toast.error("Failed to remove member");
    } catch { toast.error("Failed to remove member"); }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm("Are you sure you want to leave this room?")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Left the room"); router.push("/rooms"); }
      else toast.error("Failed to leave room");
    } catch { toast.error("Failed to leave room"); }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm("Are you sure you want to delete this room? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Room deleted successfully"); router.push("/rooms"); }
      else toast.error("Failed to delete room");
    } catch { toast.error("Failed to delete room"); }
  };

  if (loading) return <Loader fullScreen />;
  if (!room) return null;

  const allMembers = [
    { ...(room.owner || {}), role: "Owner" },
    ...(room.coOrganisers || []).map((co: any) => ({ ...co, role: "Co-Organiser" })),
    ...(room.participants || []).map((p: any) => ({ ...p, role: "Participant" })),
  ];

  const getContestStatus = (contest: any) => {
    const now = new Date();
    const start = new Date(contest.startTime);
    const end = new Date(contest.endTime);
    if (now < start) return { label: "Upcoming", bg: "rgb(59 130 246 / 0.15)", color: "#60A5FA" };
    if (now <= end) return { label: "Live", bg: "rgb(34 197 94 / 0.15)", color: "#22C55E" };
    return { label: "Ended", bg: "rgb(var(--color-panel-muted))", color: "rgb(var(--color-text-soft))" };
  };

  const getContestDuration = (contest: any) => {
    const start = new Date(contest.startTime);
    const end = new Date(contest.endTime);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  };

  return (
    <div className="page-shell">
      <div className="section-shell">
        {/* Back Button */}
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 text-muted-ui hover:text-strong mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to My Rooms
        </Link>

        {/* Room Header */}
        <div className="card mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="p-4 rounded-xl"
                style={{ background: "linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-400)))" }}
              >
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-strong">{room.name}</h1>
                {room.description && (
                  <p className="text-muted-ui mt-1">{room.description}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Room Code */}
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{ background: "rgb(var(--color-panel-muted))" }}
              >
                <span className="text-sm text-muted-ui">Code:</span>
                <span className="font-mono" style={{ color: "rgb(var(--color-accent-400))" }}>{room.shortCode}</span>
                <Copy className="w-4 h-4 text-soft-ui" />
              </button>

              {/* Copy Link */}
              <button onClick={copyRoomLink} className="btn-secondary">
                <Link2 className="w-4 h-4" />
                Copy Link
              </button>

              {/* Create Contest */}
              {isOrganiser && (
                <Link
                  href={`/admin/contest/create?roomId=${roomId}`}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Create Contest
                </Link>
              )}

              {/* Invite */}
              {isOwner && (
                <button onClick={() => setShowInviteModal(true)} className="btn-secondary">
                  <UserPlus className="w-4 h-4" />
                  Invite
                </button>
              )}

              {/* Leave Room */}
              {!isOwner && !isAdmin && (
                <button
                  onClick={handleLeaveRoom}
                  className="btn-secondary"
                  style={{ color: "rgb(248 113 113)" }}
                >
                  <LogOut className="w-4 h-4" />
                  Leave
                </button>
              )}

              {/* Delete Room */}
              {(isOwner || isAdmin) && (
                <button
                  onClick={handleDeleteRoom}
                  className="btn-secondary"
                  style={{ color: "rgb(248 113 113)" }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Room
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {[
            { key: "contests", label: `Contests (${contests.length})` },
            { key: "announcements", label: "Announcements" },
            { key: "members", label: `Members (${allMembers.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
              style={
                activeTab === t.key
                  ? { background: "rgb(var(--color-accent-500))", color: "#fff" }
                  : { background: "rgb(var(--color-panel-muted))", color: "rgb(var(--color-text-muted))" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contests Tab */}
        {activeTab === "contests" && (
          <div>
            {contests.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-muted-ui mb-4">No contests in this room yet</p>
                {isOrganiser && (
                  <Link
                    href={`/admin/contest/create?roomId=${roomId}`}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Contest
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contests.map((contest) => {
                  const status = getContestStatus(contest);
                  const duration = getContestDuration(contest);
                  const startDate = new Date(contest.startTime);
                  return (
                    <article key={contest._id} className="card-hover flex h-full flex-col">
                      {/* Status + Duration */}
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: status.bg, color: status.color }}
                        >
                          {status.label}
                        </span>
                        <span className="text-sm text-soft-ui">{duration} mins</span>
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-semibold text-strong">{contest.title}</h3>

                      {/* Hosted by */}
                      <div className="mt-2 flex items-center gap-2 text-sm text-soft-ui">
                        <User className="h-4 w-4" />
                        <span>Hosted by {contest.createdBy?.name || "Unknown"}</span>
                      </div>

                      {/* Description */}
                      <p className="mt-4 flex-1 text-sm leading-6 text-muted-ui">
                        {contest.description}
                      </p>

                      {/* 2x2 Stats Grid */}
                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-muted-ui">
                        <div className="surface-muted flex items-center gap-2 p-3">
                          <Calendar className="h-4 w-4" style={{ color: "rgb(var(--color-accent-500))" }} />
                          <span>{startDate.toLocaleDateString()}</span>
                        </div>
                        <div className="surface-muted flex items-center gap-2 p-3">
                          <Clock className="h-4 w-4" style={{ color: "rgb(var(--color-accent-500))" }} />
                          <span>{startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="surface-muted flex items-center gap-2 p-3">
                          <Users className="h-4 w-4" style={{ color: "rgb(var(--color-accent-500))" }} />
                          <span>{contest.participants?.length || 0} joined</span>
                        </div>
                        <div className="surface-muted flex items-center gap-2 p-3">
                          <Award className="h-4 w-4" style={{ color: "rgb(var(--color-accent-500))" }} />
                          <span>{(contest.sections?.mcq?.totalMarks || 0) + (contest.sections?.coding?.totalMarks || 0)} pts</span>
                        </div>
                      </div>

                      {/* View Details Button */}
                      <Link
                        href={`/contest/${contest._id}`}
                        className="btn-primary mt-5 w-full text-center"
                      >
                        {status.label === "Live" ? "Enter contest" : "View details"}
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Announcements Tab */}
        {activeTab === "announcements" && (
          <AnnouncementsTab roomId={roomId} isOrganiser={isOrganiser} token={token} />
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <div className="card">
            <div className="space-y-4">
              {allMembers.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between p-4 rounded-lg"
                  style={{ background: "rgb(var(--color-panel-muted))" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-full"
                      style={{
                        background:
                          member.role === "Owner"
                            ? "rgb(234 179 8 / 0.2)"
                            : member.role === "Co-Organiser"
                            ? "rgb(59 130 246 / 0.2)"
                            : "rgb(156 163 175 / 0.2)",
                      }}
                    >
                      {member.role === "Owner" ? (
                        <Crown className="w-5 h-5" style={{ color: "#FBBF24" }} />
                      ) : member.role === "Co-Organiser" ? (
                        <Shield className="w-5 h-5" style={{ color: "#60A5FA" }} />
                      ) : (
                        <User className="w-5 h-5 text-soft-ui" />
                      )}
                    </div>
                    <div>
                      <div className="text-strong font-medium">{member.name}</div>
                      <div className="text-soft-ui text-sm">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background:
                          member.role === "Owner"
                            ? "rgb(234 179 8 / 0.2)"
                            : member.role === "Co-Organiser"
                            ? "rgb(59 130 246 / 0.2)"
                            : "rgb(156 163 175 / 0.2)",
                        color:
                          member.role === "Owner"
                            ? "#FBBF24"
                            : member.role === "Co-Organiser"
                            ? "#60A5FA"
                            : "#9CA3AF",
                      }}
                    >
                      {member.role}
                    </span>
                    {canRemoveMembers && member._id !== user?._id && member.role !== "Owner" && (
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        className="p-1 transition-colors"
                        style={{ color: "rgb(248 113 113)" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h2 className="text-xl font-bold text-strong mb-4">Invite Co-Organiser</h2>
            <p className="text-sm text-muted-ui mb-6">
              Enter the email of an organiser to invite them as a co-organiser
            </p>

            <form onSubmit={handleInviteCoOrganiser}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="organiser@example.com"
                className="input-field w-full mb-6"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowInviteModal(false); setInviteEmail(""); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Announcements Tab Component ── */
function AnnouncementsTab({ roomId, isOrganiser, token }: { roomId: string; isOrganiser: boolean; token: string | null }) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [formData, setFormData] = useState({ title: "", content: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [roomId]);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch { toast.error("Failed to fetch announcements"); }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({ title: "", content: "" });
    setEditingAnnouncement(null);
    setShowCreateModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSubmitting(true);
    try {
      const url = editingAnnouncement
        ? `/api/rooms/${roomId}/announcements/${editingAnnouncement._id}`
        : `/api/rooms/${roomId}/announcements`;
      const method = editingAnnouncement ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success(editingAnnouncement ? "Announcement updated" : "Announcement created");
        resetForm();
        fetchAnnouncements();
      } else toast.error("Failed to save announcement");
    } catch { toast.error("Failed to save announcement"); }
    setSubmitting(false);
  };

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setFormData({ title: announcement.title, content: announcement.content });
    setShowCreateModal(true);
  };

  const handleDelete = async (announcementId: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/announcements/${announcementId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Announcement deleted"); fetchAnnouncements(); }
      else toast.error("Failed to delete announcement");
    } catch { toast.error("Failed to delete announcement"); }
  };

  const handleTogglePin = async (announcement: any) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/announcements/${announcement._id}/pin`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success(announcement.isPinned ? "Unpinned" : "Pinned");
        fetchAnnouncements();
      }
    } catch { toast.error("Failed to toggle pin"); }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div
          className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto"
          style={{ borderColor: "rgb(var(--color-accent-500))", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Create Button */}
      {isOrganiser && (
        <div className="mb-6">
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Announcement
          </button>
        </div>
      )}

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone className="w-12 h-12 text-soft-ui mx-auto mb-4" />
          <p className="text-muted-ui mb-4">No announcements yet</p>
          {isOrganiser && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create First Announcement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement._id}
              className="card"
              style={announcement.isPinned ? { border: "2px solid rgb(var(--color-accent-500) / 0.5)" } : {}}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.isPinned && (
                      <Pin className="w-4 h-4" style={{ color: "rgb(var(--color-accent-400))" }} />
                    )}
                    <h3 className="text-lg font-semibold text-strong">{announcement.title}</h3>
                  </div>
                  <p className="text-muted-ui whitespace-pre-wrap mb-4">{announcement.content}</p>

                  {/* Attachments */}
                  {announcement.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {announcement.attachments.map((file: any, idx: number) => (
                        <a
                          key={idx}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                          style={{ background: "rgb(var(--color-panel-muted))" }}
                        >
                          <FileText className="w-4 h-4" style={{ color: "rgb(var(--color-accent-400))" }} />
                          <span className="text-sm text-muted-ui">{file.fileName}</span>
                          <Download className="w-4 h-4 text-soft-ui" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="text-sm text-soft-ui">
                    Posted by {announcement.createdBy?.name || announcement.postedBy?.name || "Unknown"} •{" "}
                    {new Date(announcement.createdAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Actions */}
                {isOrganiser && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePin(announcement)}
                      className="p-2 rounded-lg transition-colors"
                      style={
                        announcement.isPinned
                          ? { background: "rgb(var(--color-accent-500) / 0.2)", color: "rgb(var(--color-accent-400))" }
                          : { background: "rgb(var(--color-panel-muted))", color: "rgb(var(--color-text-muted))" }
                      }
                      title={announcement.isPinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(announcement)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: "rgb(var(--color-panel-muted))", color: "rgb(var(--color-text-muted))" }}
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(announcement._id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ background: "rgb(var(--color-panel-muted))", color: "rgb(248 113 113)" }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-strong">
                {editingAnnouncement ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button onClick={resetForm} className="text-muted-ui hover:text-strong">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="label">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Announcement title"
                  className="input-field w-full"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="label">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Write your announcement..."
                  rows={6}
                  className="input-field w-full resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={resetForm} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formData.title.trim() || !formData.content.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingAnnouncement ? "Update" : "Post Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
