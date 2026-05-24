"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Shield, ArrowLeft, AlertTriangle, Download } from "lucide-react";

export default function ContestViolationsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/contests/${contestId}/violation`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setViolations(data.violations || []);
      } catch { toast.error("Failed to load violations"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId]);

  const typeColors: Record<string, string> = {
    TAB_SWITCH: "#EF4444", WINDOW_BLUR: "#F97316", FULLSCREEN_EXIT: "#EAB308",
    COPY_PASTE: "#A855F7", SCREENSHOT: "#EC4899", RIGHT_CLICK: "#6366F1",
  };

  // Group violations by user
  const userViolations = violations.reduce((acc: any, v: any) => {
    const uid = v.userId?._id || v.userId;
    if (!acc[uid]) acc[uid] = { user: v.userId, violations: [] };
    acc[uid].violations.push(v);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="max-w-5xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8" style={{ color: "#EF4444" }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Proctoring Violations</h1>
            <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{violations.length} total violations from {Object.keys(userViolations).length} users</p>
          </div>
        </div>

        {Object.keys(userViolations).length === 0 ? (
          <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <Shield className="w-12 h-12 mx-auto mb-4" style={{ color: "#22C55E" }} />
            <p style={{ color: "var(--foreground-secondary)" }}>No violations recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(userViolations).map((uv: any) => (
              <div key={uv.user?._id} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>{uv.user?.name || "Unknown"}</h3>
                    <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{uv.user?.email}</p>
                  </div>
                  <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold"
                    style={{ background: uv.violations.length >= 3 ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)", color: uv.violations.length >= 3 ? "#EF4444" : "#EAB308" }}>
                    <AlertTriangle className="w-4 h-4" /> {uv.violations.length} violations
                  </span>
                </div>
                <div className="space-y-2">
                  {uv.violations.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ color: typeColors[v.type] || "#9CA3AF", background: `${typeColors[v.type] || "#9CA3AF"}20` }}>
                          {v.type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{v.details || ""}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--foreground-secondary)" }}>{new Date(v.timestamp || v.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
