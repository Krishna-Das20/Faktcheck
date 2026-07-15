"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  ShieldCheck, ArrowLeft, AlertTriangle, User, Clock, RefreshCw, Camera,
} from "lucide-react";

interface Candidate {
  user: { _id: string; name: string; email: string; college?: string } | null;
  riskScore: number;
  flagCount: number;
  status: string;
  terminationReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  cameraActive: boolean;
  identityPhotoKey: string | null;
}

interface FlagItem {
  _id: string;
  type: string;
  label: string;
  source: string;
  confidence: number;
  weight: number;
  startedAt: string;
  durationMs: number;
  details: string | null;
  evidenceUrl: string | null;
}

const riskBand = (score: number, warn: number, terminate: number) => {
  if (score >= terminate) return { color: "#EF4444", label: "High" };
  if (score >= warn) return { color: "#EAB308", label: "Elevated" };
  return { color: "#22C55E", label: "Low" };
};

export default function ProctoringReviewPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [thresholds, setThresholds] = useState({ warn: 15, terminate: 60 });
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proctor/${contestId}/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setCandidates(data.candidates || []);
        setStats(data.stats);
        setThresholds(data.thresholds || { warn: 15, terminate: 60 });
      } else {
        toast.error(data.message || "Failed to load proctoring data");
      }
    } catch {
      toast.error("Failed to load proctoring data");
    } finally {
      setLoading(false);
    }
  }, [contestId, token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const openSession = async (userId: string) => {
    if (selected === userId) {
      setSelected(null);
      setSession(null);
      return;
    }
    setSelected(userId);
    setSessionLoading(true);
    try {
      const res = await fetch(`/api/proctor/${contestId}/session/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSession(data);
      else toast.error(data.message || "Failed to load session");
    } catch {
      toast.error("Failed to load session");
    } finally {
      setSessionLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="section-shell max-w-5xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-4 text-sm"
          style={{ color: "var(--foreground-secondary)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7" style={{ color: "var(--primary)" }} />
            <div>
              <h1 className="text-2xl font-bold text-strong">Proctoring Review</h1>
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                Candidates ranked by risk. Review flags and evidence, then decide.
              </p>
            </div>
          </div>
          <button onClick={fetchOverview} className="p-2 rounded-lg" title="Refresh" style={{ color: "var(--primary)" }}>
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              ["Candidates", stats.total, "var(--foreground)"],
              ["Flagged", stats.flagged, "#EAB308"],
              ["High risk", stats.highRisk, "#EF4444"],
              ["Terminated", stats.terminated, "#EF4444"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="rounded-xl p-4 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="text-2xl font-bold" style={{ color: color as string }}>{value as number}</div>
                <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{label as string}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <ShieldCheck className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-secondary)" }} />
            <p style={{ color: "var(--foreground-secondary)" }}>No proctoring data yet for this contest.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => {
              const band = riskBand(c.riskScore, thresholds.warn, thresholds.terminate);
              const uid = c.user?._id;
              const isOpen = selected === uid;
              return (
                <div key={uid} className="rounded-xl overflow-hidden" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                  <button
                    onClick={() => uid && openSession(uid)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ background: `${band.color}22` }}>
                      <User className="w-5 h-5" style={{ color: band.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--foreground)" }}>{c.user?.name || "Unknown"}</div>
                      <div className="text-sm truncate" style={{ color: "var(--foreground-secondary)" }}>{c.user?.email}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold" style={{ color: band.color }}>{c.riskScore}</div>
                      <div className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{band.label} · {c.flagCount} flags</div>
                    </div>
                    {c.terminationReason === "MALPRACTICE" && (
                      <span className="text-xs px-2 py-1 rounded-lg flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>Terminated</span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t p-4" style={{ borderColor: "var(--border)", background: "var(--background-secondary)" }}>
                      {sessionLoading ? (
                        <div className="flex justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
                        </div>
                      ) : session ? (
                        <div className="space-y-4">
                          {session.session?.identityPhotoUrl && (
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={session.session.identityPhotoUrl} alt="Identity" className="w-16 h-16 rounded-lg object-cover" />
                              <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                                <div>Identity photo captured at start</div>
                                {session.session.consentGivenAt && (
                                  <div>Consented {new Date(session.session.consentGivenAt).toLocaleString()}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {session.timeline?.length === 0 ? (
                            <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>No flags recorded.</p>
                          ) : (
                            <div className="space-y-2">
                              {session.timeline.map((f: FlagItem) => (
                                <div key={f._id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                                  {f.evidenceUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <a href={f.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                      <img src={f.evidenceUrl} alt="Evidence" className="w-12 h-12 rounded object-cover" />
                                    </a>
                                  ) : (
                                    <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: "var(--background-secondary)" }}>
                                      {f.source === "video" ? <Camera className="w-5 h-5" style={{ color: "var(--foreground-secondary)" }} /> : <AlertTriangle className="w-5 h-5" style={{ color: "#EAB308" }} />}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{f.label}</span>
                                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)" }}>+{f.weight}</span>
                                    </div>
                                    {f.details && <div className="text-xs mt-0.5 break-words" style={{ color: "var(--foreground-secondary)" }}>{f.details}</div>}
                                    <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--foreground-secondary)" }}>
                                      <Clock className="w-3 h-3" />
                                      {new Date(f.startedAt).toLocaleTimeString()}
                                      {f.source !== "browser" && ` · ${Math.round(f.confidence * 100)}% conf`}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
