"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  AlertTriangle, User, Clock, ArrowLeft, Shield,
  Monitor, MousePointer, Copy, Clipboard, Camera, RefreshCw,
} from "lucide-react";

interface ViolationUser {
  _id: string;
  name: string;
  email: string;
}

interface Violation {
  _id: string;
  userId: ViolationUser;
  type: string;
  warningNumber: number;
  details: string | null;
  timestamp: string;
  createdAt: string;
}

interface GroupedUser {
  user: ViolationUser | null;
  violations: Violation[];
  maxWarning: number;
  terminated: boolean;
}

// Map violation types to icons, labels, and colors — matches KK exactly
const violationInfo: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  TAB_SWITCH: { icon: Monitor, label: "Tab Switch", color: "#EAB308", bg: "rgba(234,179,8,0.15)" },
  FULLSCREEN_EXIT: { icon: Monitor, label: "Fullscreen Exit", color: "#F97316", bg: "rgba(249,115,22,0.15)" },
  WINDOW_BLUR: { icon: MousePointer, label: "Window Blur", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  COPY_ATTEMPT: { icon: Copy, label: "Copy Attempt", color: "#A855F7", bg: "rgba(168,85,247,0.15)" },
  PASTE_ATTEMPT: { icon: Clipboard, label: "Paste Attempt", color: "#EC4899", bg: "rgba(236,72,153,0.15)" },
  SCREENSHOT_ATTEMPT: { icon: Camera, label: "Screenshot Attempt", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
};

export default function ContestViolationsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [contest, setContest] = useState<any>(null);
  const [groupedByUser, setGroupedByUser] = useState<Record<string, GroupedUser>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchViolations();
    fetchContest();
  }, [contestId]);

  const fetchContest = async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setContest(data.contest);
    } catch {
      console.error("Error fetching contest");
    }
  };

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contests/${contestId}/violation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const vList: Violation[] = data.violations || [];
      setViolations(vList);

      // Group by user
      const grouped: Record<string, GroupedUser> = {};
      vList.forEach((v) => {
        const key = v.userId?._id || "unknown";
        if (!grouped[key]) {
          grouped[key] = {
            user: v.userId,
            violations: [],
            maxWarning: 0,
            terminated: false,
          };
        }
        grouped[key].violations.push(v);
        if (v.warningNumber > grouped[key].maxWarning) {
          grouped[key].maxWarning = v.warningNumber;
        }
        if (v.warningNumber >= 3) {
          grouped[key].terminated = true;
        }
      });
      setGroupedByUser(grouped);
    } catch {
      toast.error("Failed to fetch violations");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  const terminatedCount = Object.values(groupedByUser).filter((u) => u.terminated).length;
  const screenshotCount = violations.filter((v) => v.type === "SCREENSHOT_ATTEMPT").length;

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg transition-colors"
              style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <Shield className="w-6 h-6" style={{ color: "#EF4444" }} />
                Proctoring Violations
              </h1>
              {contest && (
                <p className="mt-1" style={{ color: "var(--foreground-secondary)" }}>
                  {contest.title}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={fetchViolations}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <div className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>{violations.length}</div>
            <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Total Violations</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>{Object.keys(groupedByUser).length}</div>
            <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Users with Violations</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold" style={{ color: "#EF4444" }}>{terminatedCount}</div>
            <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Terminated (Malpractice)</div>
          </div>
          <div className="card">
            <div className="text-3xl font-bold" style={{ color: "#EAB308" }}>{screenshotCount}</div>
            <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Screenshot Attempts</div>
          </div>
        </div>

        {violations.length === 0 ? (
          <div className="card text-center py-12">
            <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: "#22C55E" }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              No Violations Detected
            </h2>
            <p style={{ color: "var(--foreground-secondary)" }}>
              All participants followed the proctoring rules.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Users List (Left Panel) */}
            <div className="card lg:col-span-1">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <User className="w-5 h-5" />
                Violators ({Object.keys(groupedByUser).length})
              </h2>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {Object.entries(groupedByUser)
                  .sort((a, b) => b[1].maxWarning - a[1].maxWarning)
                  .map(([userId, data]) => (
                    <button
                      key={userId}
                      onClick={() => setSelectedUser(userId)}
                      className="w-full text-left p-3 rounded-lg transition-colors"
                      style={
                        selectedUser === userId
                          ? { background: `rgba(var(--primary-rgb), 0.15)`, border: `1px solid var(--primary)` }
                          : { background: "var(--background-secondary)", border: "1px solid transparent" }
                      }
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium" style={{ color: "var(--foreground)" }}>
                            {data.user?.name || "Unknown User"}
                          </div>
                          <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                            {data.user?.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={
                              data.terminated
                                ? { background: "rgba(239,68,68,0.15)", color: "#EF4444" }
                                : { background: "rgba(234,179,8,0.15)", color: "#EAB308" }
                            }
                          >
                            {data.maxWarning}/3
                          </span>
                          {data.terminated && (
                            <AlertTriangle className="w-4 h-4" style={{ color: "#EF4444" }} />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Violation Details (Right Panel) */}
            <div className="card lg:col-span-2">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
                <AlertTriangle className="w-5 h-5" style={{ color: "#EF4444" }} />
                Violation History
              </h2>

              {selectedUser && groupedByUser[selectedUser] ? (
                <div>
                  {/* User Header */}
                  <div
                    className="p-4 rounded-lg mb-4"
                    style={
                      groupedByUser[selectedUser].terminated
                        ? { background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }
                        : { background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)" }
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
                          {groupedByUser[selectedUser].user?.name}
                        </div>
                        <div style={{ color: "var(--foreground-secondary)" }}>
                          {groupedByUser[selectedUser].user?.email}
                        </div>
                      </div>
                      {groupedByUser[selectedUser].terminated && (
                        <div
                          className="px-4 py-2 rounded-lg font-semibold"
                          style={{ background: "#EF4444", color: "#fff" }}
                        >
                          🚫 TERMINATED - MALPRACTICE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {groupedByUser[selectedUser].violations
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((violation, idx) => {
                        const info = violationInfo[violation.type] || {
                          icon: AlertTriangle,
                          label: violation.type,
                          color: "#9CA3AF",
                          bg: "rgba(156,163,175,0.15)",
                        };
                        const Icon = info.icon;

                        return (
                          <div
                            key={violation._id || idx}
                            className="p-4 rounded-lg"
                            style={{ background: info.bg, border: "1px solid var(--border)" }}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className="p-2 rounded-lg"
                                style={{ background: "var(--background-secondary)", color: info.color }}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold" style={{ color: info.color }}>
                                    Warning #{violation.warningNumber}: {info.label}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm" style={{ color: "var(--foreground-secondary)" }}>
                                    <Clock className="w-4 h-4" />
                                    {formatTime(violation.timestamp)}
                                  </div>
                                </div>
                                {violation.details && (
                                  <div className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>
                                    {violation.details}
                                  </div>
                                )}
                                {violation.warningNumber >= 3 && (
                                  <div className="mt-2 text-sm font-medium" style={{ color: "#EF4444" }}>
                                    ⚠️ This violation triggered auto-submission
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12" style={{ color: "var(--foreground-secondary)" }}>
                  <User className="w-12 h-12 mx-auto mb-4" style={{ opacity: 0.5 }} />
                  <p>Select a user to view their violation details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
