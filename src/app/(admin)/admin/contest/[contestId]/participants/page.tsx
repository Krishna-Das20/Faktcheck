"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  Users, UserCheck, Clock, CheckCircle,
  AlertTriangle, ArrowLeft, Mail, Building2,
} from "lucide-react";

interface ParticipantUser {
  id: string;
  name: string;
  email: string;
  college?: string;
  phone?: string;
}

interface Participant {
  user: ParticipantUser;
  registeredAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  status: string;
  terminationReason: string | null;
  warningCount: number;
  sectionStatuses: {
    mcq: string;
    coding: string;
    forms: string;
  };
  sectionTimes: {
    mcq: number;
    coding: number;
    forms: number;
  };
}

interface Stats {
  totalRegistered: number;
  totalStarted: number;
  totalSubmitted: number;
  totalTimedOut: number;
  totalMalpractice: number;
  notStarted: number;
}

const FILTERS = ["ALL", "REGISTERED", "IN_PROGRESS", "SUBMITTED", "TIMED_OUT", "MALPRACTICE"] as const;

export default function ContestParticipantsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchParticipants();
  }, [contestId]);

  const fetchParticipants = async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/participants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setParticipants(data.participants);
      }
    } catch {
      toast.error("Failed to fetch participants");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string, terminationReason: string | null) => {
    if (terminationReason === "MALPRACTICE") {
      return (
        <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>
          <AlertTriangle className="w-3 h-3" />
          MALPRACTICE
        </span>
      );
    }
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="badge" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}>
            <CheckCircle className="w-3 h-3" />
            SUBMITTED
          </span>
        );
      case "TIMED_OUT":
        return (
          <span className="badge" style={{ background: "rgba(249,115,22,0.15)", color: "#F97316", border: "1px solid rgba(249,115,22,0.3)" }}>
            <Clock className="w-3 h-3" />
            TIMED OUT
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="badge" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.3)" }}>
            <Clock className="w-3 h-3" />
            IN PROGRESS
          </span>
        );
      case "REGISTERED":
        return (
          <span className="badge" style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.3)" }}>
            <UserCheck className="w-3 h-3" />
            REGISTERED
          </span>
        );
      default:
        return (
          <span className="badge" style={{ background: "rgba(156,163,175,0.15)", color: "#9CA3AF" }}>
            {status || "UNKNOWN"}
          </span>
        );
    }
  };

  const getSectionBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>✓</span>;
      case "IN_PROGRESS":
        return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>⏳</span>;
      default:
        return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "rgba(156,163,175,0.1)", color: "#9CA3AF" }}>—</span>;
    }
  };

  const formatSectionTime = (seconds: number) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const filteredParticipants = participants.filter((p) => {
    if (filter === "ALL") return true;
    if (filter === "REGISTERED") return p.status === "REGISTERED";
    if (filter === "IN_PROGRESS") return p.status === "IN_PROGRESS";
    if (filter === "SUBMITTED") return p.status === "SUBMITTED";
    if (filter === "TIMED_OUT") return p.status === "TIMED_OUT";
    if (filter === "MALPRACTICE") return p.terminationReason === "MALPRACTICE";
    return true;
  });

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  const statCards = stats
    ? [
        { value: stats.totalRegistered, label: "Registered", color: "#A855F7" },
        { value: stats.totalStarted, label: "Started", color: "#3B82F6" },
        { value: stats.totalSubmitted, label: "Submitted", color: "#22C55E" },
        { value: stats.totalTimedOut, label: "Timed Out", color: "#F97316" },
        { value: stats.totalMalpractice, label: "Malpractice", color: "#EF4444" },
        { value: stats.notStarted, label: "Not Started", color: "#9CA3AF" },
      ]
    : [];

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 transition-colors"
            style={{ color: "var(--foreground-secondary)" }}
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-3" style={{ color: "var(--foreground)" }}>
            <Users className="w-8 h-8" style={{ color: "var(--primary)" }} />
            Contest Participants
          </h1>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {statCards.map((s) => (
              <div key={s.label} className="card text-center">
                <div className="text-2xl font-bold" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                filter === f
                  ? { background: "var(--primary)", color: "#fff" }
                  : { background: "var(--background-secondary)", color: "var(--foreground-secondary)" }
              }
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Participants Table */}
        <div className="table-shell">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>#</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>User</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>MCQ</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Coding</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Forms</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Warnings</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Started At</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: "var(--foreground-secondary)" }}>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {filteredParticipants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center" style={{ color: "var(--foreground-secondary)" }}>
                    No participants found
                  </td>
                </tr>
              ) : (
                filteredParticipants.map((participant, index) => (
                  <tr key={participant.user.id || index}>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground-secondary)" }}>{index + 1}</td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium" style={{ color: "var(--foreground)" }}>{participant.user.name}</div>
                        <div className="text-xs flex items-center gap-1" style={{ color: "var(--foreground-secondary)" }}>
                          <Mail className="w-3 h-3" />
                          {participant.user.email}
                        </div>
                        {participant.user.college && (
                          <div className="text-xs flex items-center gap-1 mt-1" style={{ color: "var(--foreground-secondary)", opacity: 0.7 }}>
                            <Building2 className="w-3 h-3" />
                            {participant.user.college}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(participant.status, participant.terminationReason)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getSectionBadge(participant.sectionStatuses?.mcq || "NOT_STARTED")}
                        {participant.sectionTimes?.mcq > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--foreground-secondary)" }}>
                            {formatSectionTime(participant.sectionTimes.mcq)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getSectionBadge(participant.sectionStatuses?.coding || "NOT_STARTED")}
                        {participant.sectionTimes?.coding > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--foreground-secondary)" }}>
                            {formatSectionTime(participant.sectionTimes.coding)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        {getSectionBadge(participant.sectionStatuses?.forms || "NOT_STARTED")}
                        {participant.sectionTimes?.forms > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--foreground-secondary)" }}>
                            {formatSectionTime(participant.sectionTimes.forms)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: (participant.warningCount || 0) >= 3 ? "rgba(239,68,68,0.15)" : "rgba(156,163,175,0.1)",
                          color: (participant.warningCount || 0) >= 3 ? "#EF4444" : (participant.warningCount || 0) > 0 ? "#F97316" : "var(--foreground-secondary)",
                        }}
                      >
                        {participant.warningCount || 0}/3
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                      {formatDateTime(participant.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                      {formatDateTime(participant.submittedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
