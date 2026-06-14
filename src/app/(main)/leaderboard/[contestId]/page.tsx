"use client";

import { useState, useEffect, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/common/Loader";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Trophy, Medal, Award, ChevronDown, ChevronUp,
  ArrowLeft, Clock, Shield, Users,
  Download, Timer, Eye, FileText, Code,
  CheckCircle, XCircle, ClipboardList, TrendingUp,
} from "lucide-react";

const formatTime = (seconds: number | null | undefined) => {
  if (!seconds && seconds !== 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
};

export default function ContestLeaderboardPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { user, token } = useAuth();

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isDetailedView, setIsDetailedView] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const headers: any = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    Promise.all([
      fetch(`/api/leaderboard/${contestId}`, { headers }).then((r) => r.json()),
      fetch(`/api/leaderboard/${contestId}/stats`, { headers }).then((r) => r.json()),
    ]).then(([lbData, statsData]) => {
      setLeaderboard(lbData.leaderboard || []);
      setUserRank(lbData.userRank || null);
      setIsDetailedView(lbData.isDetailedView || false);
      setStats(statsData.stats || null);
    }).catch(() => toast.error("Failed to fetch leaderboard"))
      .finally(() => setLoading(false));
  }, [contestId, token]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) {
      return (
        <div
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 56, height: 56,
            borderColor: 'rgb(249 179 43 / 0.45)',
            background: 'radial-gradient(circle at 30% 30%, rgb(249 179 43 / 0.16), rgb(249 179 43 / 0.05) 48%, transparent 78%)',
            boxShadow: 'inset 0 0 24px rgb(249 179 43 / 0.08), 0 0 28px rgb(249 179 43 / 0.08), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
        >
          <span className="text-2xl" role="img" aria-label="1st Place Trophy">🏆</span>
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 56, height: 56,
            borderColor: 'rgb(148 163 184 / 0.42)',
            background: 'radial-gradient(circle at 30% 30%, rgb(148 163 184 / 0.15), rgb(148 163 184 / 0.05) 48%, transparent 78%)',
            boxShadow: 'inset 0 0 24px rgb(148 163 184 / 0.08), 0 0 24px rgb(148 163 184 / 0.06), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
        >
          <span className="text-2xl" role="img" aria-label="2nd Place Medal" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>🥈</span>
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div
          className="flex items-center justify-center rounded-full border"
          style={{
            width: 56, height: 56,
            borderColor: 'rgb(249 115 22 / 0.45)',
            background: 'radial-gradient(circle at 30% 30%, rgb(249 115 22 / 0.16), rgb(249 115 22 / 0.05) 48%, transparent 78%)',
            boxShadow: 'inset 0 0 24px rgb(249 115 22 / 0.08), 0 0 24px rgb(249 115 22 / 0.07), 0 0 0 1px rgba(255,255,255,0.02)',
          }}
        >
          <span className="text-2xl" role="img" aria-label="3rd Place Medal" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>🥉</span>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center rounded-full text-sm font-semibold" style={{ height: 48, minWidth: 48, padding: '0 12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: '#d1d5db' }}>
        #{rank}
      </div>
    );
  };



  // On-demand fetch of detailed user stats (admin/organiser only)
  const fetchUserDetails = async (userId: string) => {
    if (!isDetailedView) return;
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserDetails(null);
      return;
    }
    setExpandedUser(userId);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/leaderboard/${contestId}/user/${userId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUserDetails(data.userDetails || null);
    } catch {
      toast.error("Failed to load user details");
    }
    setLoadingDetails(false);
  };

  const getStatusBadge = (status: string, terminationReason?: string) => {
    if (terminationReason === "MALPRACTICE") {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(239,68,68,0.2)", color: "#EF4444" }}>Malpractice</span>;
    }
    switch (status) {
      case "SUBMITTED":
      case "EVALUATED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(34,197,94,0.2)", color: "#22C55E" }}>Submitted</span>;
      case "TIMED_OUT":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(234,179,8,0.2)", color: "#EAB308" }}>Timed Out</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(107,114,128,0.2)", color: "#9CA3AF" }}>{status}</span>;
    }
  };

  const exportToCSV = () => {
    if (!leaderboard.length) { toast.error("No data to export"); return; }
    const headers = isDetailedView
      ? ["Rank", "Name", "Email", "College", "MCQ Score", "Coding Score", "Total Score", "Time Taken", "Status", "Warnings", "MCQ Section Time", "Coding Section Time"]
      : ["Rank", "Name", "College", "MCQ Score", "Coding Score", "Total Score", "Time Taken"];
    const rows = leaderboard.map((entry) => {
      const base = [
        entry.rank, entry.user?.name || "Unknown",
        ...(isDetailedView ? [entry.user?.email || ""] : []),
        entry.user?.college || "", entry.mcqScore || 0, entry.codingScore || 0,
        entry.totalScore || 0, formatTime(entry.timeTaken),
      ];
      if (isDetailedView) {
        base.push(
          entry.details?.progressStatus || entry.status || "N/A",
          entry.details?.warningCount || 0,
          formatTime(entry.details?.mcqSectionTime),
          formatTime(entry.details?.codingSectionTime),
        );
      }
      return base;
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leaderboard_${contestId}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Leaderboard exported!");
  };

  if (loading) return <Loader fullScreen />;

  return (
    <div className="page-shell">
      <div className="section-shell" style={{ maxWidth: "72rem", margin: "0 auto" }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-ui hover:text-strong transition-colors">
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            {isDetailedView && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={exportToCSV} className="btn-outline flex items-center gap-2 px-3 sm:px-4 py-2 text-sm">
                  <Download className="w-4 h-4" /><span className="hidden sm:inline">Export CSV</span>
                </button>
                <Link href={`/admin/contest/${contestId}/participants`} className="btn-outline flex items-center gap-2 px-3 sm:px-4 py-2 text-sm">
                  <Users className="w-4 h-4" /><span className="hidden sm:inline">Participants</span>
                </Link>
                <Link href={`/admin/contest/${contestId}/violations`} className="btn-outline flex items-center gap-2 px-3 sm:px-4 py-2 text-sm">
                  <Shield className="w-4 h-4" /><span className="hidden sm:inline">Violations</span>
                </Link>
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 mb-2 text-white font-display">
            <Trophy className="w-7 h-7 sm:w-10 sm:h-10 text-primary-500" />
            Leaderboard
          </h1>
          {stats && <p className="text-gray-400">{stats.contestTitle}</p>}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              { label: "Total Participants", value: stats.totalParticipants, color: "#FF6B35" },
              { label: "Submitted", value: stats.submitted, color: "#22C55E" },
              { label: "Average Score", value: stats.averageScore?.toFixed(1) || 0, color: "#3B82F6" },
            ].map((s) => (
              <div key={s.label} className="card p-6 text-center">
                <div className="text-3xl font-bold mb-2" style={{ color: s.color }}>{s.value}</div>
                <div className="text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* User rank hint */}
        {userRank && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(var(--primary-rgb,255,107,53),0.1)", border: "1px solid rgba(var(--primary-rgb,255,107,53),0.3)", color: "#FF6B35" }}>
            <Trophy className="w-4 h-4 inline mr-2" /> Your rank: <strong>#{userRank}</strong>
          </div>
        )}

        {/* Admin Hint */}
        {isDetailedView && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: "rgba(var(--primary-rgb,255,107,53),0.1)", border: "1px solid rgba(var(--primary-rgb,255,107,53),0.3)", color: "#FF6B35" }}>
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Click on any participant row to view detailed time breakdown per question and section
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="card overflow-hidden p-0">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-ui" />
              <p className="text-lg text-muted-ui">No submissions yet</p>
            </div>
          ) : (
            <div>
              <table className="w-full">
                <thead style={{ background: "var(--background-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>Rank</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>Participant</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold hidden sm:table-cell" style={{ color: "var(--foreground-secondary)" }}>MCQ</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold hidden sm:table-cell" style={{ color: "var(--foreground-secondary)" }}>Coding</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>Total</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold hidden sm:table-cell" style={{ color: "var(--foreground-secondary)" }}>Time</th>
                    {isDetailedView && (
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>Details</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <Fragment key={entry.rank}>
                      <tr
                        className="transition-colors"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          cursor: isDetailedView ? "pointer" : "default",
                          background: entry.rank <= 3 ? "rgba(var(--primary-rgb, 255,107,53), 0.05)" : "transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--background-secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = entry.rank <= 3 ? "rgba(var(--primary-rgb, 255,107,53), 0.05)" : "transparent")}
                        onClick={() => isDetailedView && fetchUserDetails(entry.userId || entry.user?._id)}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">{getRankIcon(entry.rank)}</div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #FF6B35, #9333ea)' }}>
                              {entry.user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm sm:text-base truncate" style={{ color: "var(--foreground)" }}>{entry.user?.name}</div>
                              {isDetailedView && entry.user?.email && (
                                <div className="text-xs sm:text-sm truncate" style={{ color: "var(--foreground-secondary)" }}>{entry.user.email}</div>
                              )}
                              {entry.user?.college && <div className="text-xs truncate" style={{ color: "var(--foreground-secondary)" }}>{entry.user.college}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center font-semibold hidden sm:table-cell" style={{ color: "#60a5fa" }}>{entry.mcqScore || 0}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center font-semibold hidden sm:table-cell" style={{ color: "#4ade80" }}>{entry.codingScore || 0}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                          <span className="font-bold text-base sm:text-lg" style={{ color: "#FF6B35" }}>{entry.totalScore}</span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-center hidden sm:table-cell" style={{ color: "var(--foreground-secondary)" }}>
                          {formatTime(entry.timeTaken)}
                        </td>
                        {isDetailedView && (
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                            {expandedUser === (entry.userId || entry.user?._id) ? <ChevronUp className="w-5 h-5" style={{ color: "#FF6B35" }} /> : <ChevronDown className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} />}
                          </td>
                        )}
                      </tr>

                      {/* Expanded Detail Row — on-demand fetch */}
                      {isDetailedView && expandedUser === (entry.userId || entry.user?._id) && (
                        <tr>
                          <td colSpan={isDetailedView ? 7 : 6} className="p-6" style={{ background: "var(--background-secondary)" }}>
                            {loadingDetails ? (
                              <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderTopColor: "#FF6B35" }} />
                              </div>
                            ) : userDetails ? (
                              <div className="space-y-6">
                                {/* View Full Answers Button */}
                                <div className="flex justify-end">
                                  <Link
                                    href={`/admin/contest/${contestId}/user/${entry.userId || entry.user?._id}/answers`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                                    style={{ background: "#FF6B35" }}
                                  >
                                    <Eye className="w-4 h-4" /> View Full Answers
                                  </Link>
                                </div>

                                {/* Section Time Summary Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                  {[
                                    { icon: FileText, label: "MCQ Section", value: formatTime(userDetails.mcqSectionTime), color: "#3B82F6" },
                                    { icon: Code, label: "Coding Section", value: formatTime(userDetails.codingSectionTime), color: "#22C55E" },
                                    { icon: ClipboardList, label: "Forms Section", value: formatTime(userDetails.formsSectionTime), color: "#06B6D4" },
                                    { icon: Timer, label: "Total Time", value: formatTime(userDetails.totalTimeSpent), color: "#FF6B35" },
                                    { icon: Trophy, label: "Final Score", value: userDetails.totalScore, color: "#EAB308" },
                                  ].map((card) => (
                                    <div key={card.label} className="rounded-lg p-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                                      <div className="flex items-center gap-2 mb-2" style={{ color: card.color }}>
                                        <card.icon className="w-5 h-5" />
                                        <span className="font-semibold text-sm">{card.label}</span>
                                      </div>
                                      <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{card.value}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* Category Time Breakdown */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground-secondary)" }}>
                                      <FileText className="w-4 h-4" /> MCQ Time by Category
                                    </h4>
                                    <div className="space-y-2">
                                      {Object.entries(userDetails.mcqCategoryTime || {}).map(([cat, time]) => (
                                        <div key={cat} className="flex justify-between items-center p-2 rounded" style={{ background: "var(--background-card)" }}>
                                          <span style={{ color: "var(--foreground)" }}>{cat}</span>
                                          <span className="font-mono" style={{ color: "#3B82F6" }}>{formatTime(time as number)}</span>
                                        </div>
                                      ))}
                                      {Object.keys(userDetails.mcqCategoryTime || {}).length === 0 && <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No category data</p>}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground-secondary)" }}>
                                      <Code className="w-4 h-4" /> Coding Time by Category
                                    </h4>
                                    <div className="space-y-2">
                                      {Object.entries(userDetails.codingCategoryTime || {}).map(([cat, time]) => (
                                        <div key={cat} className="flex justify-between items-center p-2 rounded" style={{ background: "var(--background-card)" }}>
                                          <span style={{ color: "var(--foreground)" }}>{cat}</span>
                                          <span className="font-mono" style={{ color: "#22C55E" }}>{formatTime(time as number)}</span>
                                        </div>
                                      ))}
                                      {Object.keys(userDetails.codingCategoryTime || {}).length === 0 && <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No category data</p>}
                                    </div>
                                  </div>
                                </div>

                                {/* Per-Question/Problem/Form Time Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-secondary)" }}>MCQ Question Times</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {(userDetails.mcqTimeDetails || []).map((q: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-2 rounded text-sm" style={{ background: "var(--background-card)" }}>
                                          <span className="truncate max-w-[200px]" style={{ color: "var(--foreground-secondary)" }} title={q.questionText}>Q{i + 1}: {q.questionText}</span>
                                          <span className="font-mono" style={{ color: "#3B82F6" }}>{formatTime(q.timeSpent)}</span>
                                        </div>
                                      ))}
                                      {(userDetails.mcqTimeDetails || []).length === 0 && <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No question data</p>}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-secondary)" }}>Coding Problem Times</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {(userDetails.codingTimeDetails || []).map((p: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-2 rounded text-sm" style={{ background: "var(--background-card)" }}>
                                          <span className="truncate max-w-[200px]" style={{ color: "var(--foreground-secondary)" }} title={p.title}>P{i + 1}: {p.title}</span>
                                          <span className="font-mono" style={{ color: "#22C55E" }}>{formatTime(p.timeSpent)}</span>
                                        </div>
                                      ))}
                                      {(userDetails.codingTimeDetails || []).length === 0 && <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No problem data</p>}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground-secondary)" }}>Form Times</h4>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                      {(userDetails.formsTimeDetails || []).map((f: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-2 rounded text-sm" style={{ background: "var(--background-card)" }}>
                                          <span className="truncate max-w-[200px]" style={{ color: "var(--foreground-secondary)" }} title={f.title}>F{i + 1}: {f.title}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono" style={{ color: "#06B6D4" }}>{formatTime(f.timeSpent)}</span>
                                            {f.isEvaluated ? (
                                              <span className="text-xs" style={{ color: "#22C55E" }}>{f.score}/{f.maxScore}</span>
                                            ) : (
                                              <span className="text-xs" style={{ color: "#EAB308" }}>Pending</span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      {(userDetails.formsTimeDetails || []).length === 0 && <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No form data</p>}
                                    </div>
                                  </div>
                                </div>

                                {/* MCQ Answer Details */}
                                {userDetails.mcqAnswerDetails?.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground-secondary)" }}>
                                      <FileText className="w-4 h-4" /> MCQ Answer Details
                                      <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                                        ({userDetails.mcqAnswerDetails.filter((q: any) => q.isCorrect).length}/{userDetails.mcqAnswerDetails.length} correct)
                                      </span>
                                    </h4>
                                    <div className="max-h-64 overflow-y-auto space-y-2">
                                      {userDetails.mcqAnswerDetails.map((q: any, i: number) => (
                                        <div key={i} className="p-3 rounded-lg" style={{ background: "var(--background-card)", borderLeft: `3px solid ${q.isCorrect ? "#22C55E" : q.unanswered ? "#6B7280" : "#EF4444"}` }}>
                                          <div className="flex items-start justify-between mb-2">
                                            <span className="text-sm flex-1" style={{ color: "var(--foreground)" }}>
                                              <span className="font-mono mr-2" style={{ color: "var(--foreground-secondary)" }}>Q{i + 1}</span>
                                              {q.questionText}
                                            </span>
                                            <div className="flex items-center gap-2 ml-3 shrink-0">
                                              {q.unanswered ? (
                                                <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>Unanswered</span>
                                              ) : q.isCorrect ? (
                                                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#22C55E" }}><CheckCircle className="w-4 h-4" /> +{q.marksAwarded}</span>
                                              ) : (
                                                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#EF4444" }}><XCircle className="w-4 h-4" /> {q.marksAwarded}</span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-1">
                                            {q.options?.map((opt: any, j: number) => (
                                              <div key={j} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{
                                                background: opt.isCorrect && opt.wasSelected ? "rgba(34,197,94,0.2)" : opt.isCorrect ? "rgba(34,197,94,0.1)" : opt.wasSelected ? "rgba(239,68,68,0.2)" : "var(--background-secondary)",
                                                color: opt.isCorrect ? "#22C55E" : opt.wasSelected ? "#EF4444" : "var(--foreground-secondary)",
                                                border: opt.isCorrect && opt.wasSelected ? "1px solid rgba(34,197,94,0.3)" : opt.isCorrect ? "1px solid rgba(34,197,94,0.2)" : opt.wasSelected ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent",
                                              }}>
                                                {opt.isCorrect && <CheckCircle className="w-3 h-3" />}
                                                {opt.wasSelected && !opt.isCorrect && <XCircle className="w-3 h-3" />}
                                                {opt.text}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Coding Submission Details */}
                                {userDetails.codingAnswerDetails?.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground-secondary)" }}>
                                      <Code className="w-4 h-4" /> Coding Submission Details
                                      <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                                        ({userDetails.codingAnswerDetails.filter((p: any) => p.solved).length}/{userDetails.codingAnswerDetails.length} solved)
                                      </span>
                                    </h4>
                                    <div className="space-y-3">
                                      {userDetails.codingAnswerDetails.map((p: any, i: number) => (
                                        <div key={i} className="p-3 rounded-lg" style={{ background: "var(--background-card)", borderLeft: `3px solid ${p.solved ? "#22C55E" : p.unanswered ? "#6B7280" : "#EAB308"}` }}>
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-sm" style={{ color: "var(--foreground-secondary)" }}>P{i + 1}</span>
                                              <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{p.title}</span>
                                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)" }}>{p.category}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-sm font-bold" style={{ color: p.bestScore >= p.maxScore ? "#22C55E" : "#EAB308" }}>{p.bestScore}/{p.maxScore}</span>
                                              <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{p.totalAttempts} attempt{p.totalAttempts !== 1 ? "s" : ""}</span>
                                            </div>
                                          </div>
                                          {p.submissions?.length > 0 && (
                                            <div className="max-h-32 overflow-y-auto space-y-1">
                                              {p.submissions.map((sub: any, j: number) => (
                                                <div key={j} className="flex items-center justify-between px-2 py-1 rounded text-xs" style={{ background: "var(--background-secondary)" }}>
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-mono" style={{ color: "var(--foreground-secondary)" }}>#{j + 1}</span>
                                                    <span className="px-1.5 py-0.5 rounded font-medium" style={{
                                                      background: sub.verdict === "ACCEPTED" ? "rgba(34,197,94,0.2)" : sub.verdict === "WRONG_ANSWER" ? "rgba(239,68,68,0.2)" : sub.verdict === "TIME_LIMIT_EXCEEDED" ? "rgba(234,179,8,0.2)" : "rgba(249,115,22,0.2)",
                                                      color: sub.verdict === "ACCEPTED" ? "#22C55E" : sub.verdict === "WRONG_ANSWER" ? "#EF4444" : sub.verdict === "TIME_LIMIT_EXCEEDED" ? "#EAB308" : "#F97316",
                                                    }}>{sub.verdict?.replace(/_/g, " ")}</span>
                                                    <span style={{ color: "var(--foreground-secondary)" }}>{sub.language}</span>
                                                  </div>
                                                  <div className="flex items-center gap-3">
                                                    <span style={{ color: "var(--foreground-secondary)" }}>{sub.testcasesPassed}/{sub.totalTestcases} passed</span>
                                                    <span className="font-mono" style={{ color: "var(--foreground-secondary)" }}>{sub.score} pts</span>
                                                    <span style={{ color: "var(--foreground-secondary)" }}>{new Date(sub.submittedAt).toLocaleTimeString()}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-center py-4" style={{ color: "var(--foreground-secondary)" }}>Failed to load details</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-muted-ui">
          <span className="flex items-center gap-1"><span role="img" aria-label="1st">🏆</span> 1st place</span>
          <span className="flex items-center gap-1"><span role="img" aria-label="2nd">🥈</span> 2nd place</span>
          <span className="flex items-center gap-1"><span role="img" aria-label="3rd">🥉</span> 3rd place</span>
          {isDetailedView && <span className="text-xs italic ml-auto">Click on any row to view detailed breakdowns per question</span>}
        </div>
      </div>
    </div>
  );
}
