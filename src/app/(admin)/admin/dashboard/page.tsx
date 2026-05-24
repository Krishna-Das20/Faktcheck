"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Plus, Trophy, Users, Calendar, Code, FileQuestion, Edit,
  Trash2, Eye, BarChart3, UserCheck, Clock, ClipboardList,
  StopCircle, CheckSquare, Globe, DoorOpen,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "ADMIN";

  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalContests: 0, liveContests: 0, totalParticipants: 0, upcomingContests: 0 });

  useEffect(() => {
    if (user?.role !== "ADMIN" && user?.role !== "ORGANISER") {
      toast.error("Access denied");
      router.push("/");
      return;
    }
    fetchContests();
  }, [user]);

  const fetchContests = async () => {
    try {
      const res = await fetch("/api/contests/admin", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setContests(data.contests || []);
      setStats(data.stats || stats);
    } catch { toast.error("Failed to load contests"); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contest?")) return;
    try {
      await fetch(`/api/contests/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Contest deleted");
      fetchContests();
    } catch { toast.error("Failed to delete"); }
  };

  const handleEnd = async (id: string, title: string) => {
    if (!confirm(`⚠️ END CONTEST: "${title}"\n\nThis will set the end time to NOW and auto-submit all active participants.\n\nThis CANNOT be undone.`)) return;
    try {
      await fetch(`/api/contests/${id}/end`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      toast.success("Contest ended");
      fetchContests();
    } catch { toast.error("Failed to end contest"); }
  };

  const getStatus = (c: any) => {
    const now = new Date();
    if (now < new Date(c.startTime)) return "UPCOMING";
    if (now <= new Date(c.endTime)) return "LIVE";
    return "ENDED";
  };

  const statusStyle = (s: string) => {
    if (s === "LIVE") return { background: "rgba(34,197,94,0.2)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.5)" };
    if (s === "UPCOMING") return { background: "rgba(59,130,246,0.2)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.5)" };
    return { background: "rgba(107,114,128,0.2)", color: "#9CA3AF", border: "1px solid rgba(107,114,128,0.5)" };
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center" >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="page-shell" >
      <div className="section-shell">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold mb-2 text-strong">
              {isAdmin ? "Admin Dashboard" : "Organiser Dashboard"}
            </h1>
            <p style={{ color: "var(--foreground-secondary)" }}>Manage contests, MCQs, and coding problems</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <>
                <button onClick={() => router.push("/admin/users")} className="flex items-center px-4 py-2 rounded-lg text-sm transition-colors" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                  <UserCheck className="w-5 h-5 mr-2" /> Manage Users
                </button>
                <button onClick={() => router.push("/admin/verify-contests")} className="flex items-center px-4 py-2 rounded-lg text-sm transition-colors" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                  <Clock className="w-5 h-5 mr-2" /> Pending Approvals
                </button>
              </>
            )}
            <button onClick={() => router.push("/admin/contest/create")} className="flex items-center px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
              <Plus className="w-5 h-5 mr-2" /> Create Contest
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Contests", value: stats.totalContests, icon: Trophy, color: "var(--primary)" },
            { label: "Live Contests", value: stats.liveContests, icon: Calendar, color: "#22C55E" },
            { label: "Upcoming", value: stats.upcomingContests, icon: Calendar, color: "#3B82F6" },
            { label: "Total Participants", value: stats.totalParticipants, icon: Users, color: "#A855F7" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm mb-1" style={{ color: "var(--foreground-secondary)" }}>{s.label}</p>
                  <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                  <s.icon className="w-6 h-6" style={{ color: s.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contests Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between p-6">
            <h2 className="text-xl font-bold text-strong">All Contests</h2>
          </div>

          {contests.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
              <p className="mb-4" style={{ color: "var(--foreground-secondary)" }}>No contests created yet</p>
              <button onClick={() => router.push("/admin/contest/create")} className="px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
                Create Your First Contest
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Contest", "Host", "Status", "Schedule", "Participants", "Sections", "Actions"].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contests.map((c) => {
                    const status = getStatus(c);
                    return (
                      <tr key={c._id} style={{ borderBottom: "1px solid var(--border)" }}
                        className="transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-4 px-4">
                          <p className="font-semibold text-strong">{c.title}</p>
                          <p className="text-sm line-clamp-1" style={{ color: "var(--foreground-secondary)" }}>{c.description}</p>
                        </td>
                        <td className="py-4 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{c.createdBy?.name || "Admin"}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 rounded text-xs font-semibold" style={statusStyle(status)}>{status}</span>
                          {c.verificationStatus === "PENDING" && <span className="ml-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: "rgba(234,179,8,0.2)", color: "#EAB308" }}>PENDING</span>}
                        </td>
                        <td className="py-4 px-4 text-xs" style={{ color: "var(--foreground-secondary)" }}>
                          <div>{new Date(c.startTime).toLocaleDateString()} {new Date(c.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          <div>to</div>
                          <div>{new Date(c.endTime).toLocaleDateString()} {new Date(c.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
                            <span className="font-semibold text-strong">{c.participants?.length || 0}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-1">
                            {c.sections?.mcq?.enabled && <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(168,85,247,0.2)", color: "#A855F7" }}>MCQ</span>}
                            {c.sections?.coding?.enabled && <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(34,197,94,0.2)", color: "#22C55E" }}>Coding</span>}
                            {c.sections?.forms?.enabled && <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(6,182,212,0.2)", color: "#06B6D4" }}>Forms</span>}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => router.push(`/contest/${c._id}`)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="View"><Eye className="w-4 h-4" style={{ color: "#3B82F6" }} /></button>
                            <button onClick={() => router.push(`/leaderboard/${c._id}`)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="Leaderboard"><BarChart3 className="w-4 h-4" style={{ color: "#22C55E" }} /></button>
                            {status === "LIVE" && <button onClick={() => handleEnd(c._id, c.title)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="End Now"><StopCircle className="w-4 h-4" style={{ color: "#EF4444" }} /></button>}
                            {c.sections?.mcq?.enabled && <button onClick={() => router.push(`/admin/contest/mcq/${c._id}`)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="Manage MCQs"><FileQuestion className="w-4 h-4" style={{ color: "#A855F7" }} /></button>}
                            {c.sections?.coding?.enabled && <button onClick={() => router.push(`/admin/contest/coding/${c._id}`)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="Manage Coding"><Code className="w-4 h-4" style={{ color: "#F97316" }} /></button>}
                            <button onClick={() => router.push(`/admin/contest/edit/${c._id}`)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="Edit"><Edit className="w-4 h-4" style={{ color: "#EAB308" }} /></button>
                            <button onClick={() => handleDelete(c._id)} className="p-2 rounded-lg transition-colors hover:opacity-80 cursor-pointer" title="Delete"><Trash2 className="w-4 h-4" style={{ color: "#EF4444" }} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {[
            { href: "/admin/contest/create", icon: Trophy, color: "var(--primary)", title: "Create Contest", desc: "Set up a new contest with MCQs and problems" },
            { href: "/admin/mcq-library", icon: FileQuestion, color: "#A855F7", title: "MCQ Library", desc: "Manage reusable MCQ questions with categories" },
            { href: "/admin/coding-library", icon: Code, color: "#F97316", title: "Coding Library", desc: "Manage reusable coding problems with test cases" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="rounded-xl p-6 text-left transition-all hover:scale-[1.02]" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <a.icon className="w-8 h-8 mb-3" style={{ color: a.color }} />
              <h3 className="text-lg font-bold mb-2 text-strong">{a.title}</h3>
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
