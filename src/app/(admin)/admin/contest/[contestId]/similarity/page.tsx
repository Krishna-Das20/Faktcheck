"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { ArrowLeft, Code, Users, Play, AlertTriangle } from "lucide-react";

interface Pair {
  problem: { _id: string; title: string };
  language: string;
  similarity: number;
  candidateA: { _id: string; name: string; email?: string };
  candidateB: { _id: string; name: string; email?: string };
}

const simColor = (s: number) => (s >= 0.85 ? "#EF4444" : s >= 0.7 ? "#F97316" : "#EAB308");

export default function SimilarityPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [threshold, setThreshold] = useState(0.6);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [scanned, setScanned] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const runScan = useCallback(async () => {
    setLoading(true);
    setRan(true);
    try {
      const res = await fetch(`/api/proctor/${contestId}/similarity?threshold=${threshold}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPairs(data.pairs || []);
        setScanned(data.scanned ?? null);
        setTruncated(!!data.truncated);
      } else {
        toast.error(data.message || "Scan failed");
      }
    } catch {
      toast.error("Scan failed");
    } finally {
      setLoading(false);
    }
  }, [contestId, threshold, token]);

  return (
    <div className="page-shell">
      <div className="section-shell max-w-4xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Code className="w-7 h-7" style={{ color: "var(--primary)" }} />
          <h1 className="text-2xl font-bold text-strong">Code Similarity</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--foreground-secondary)" }}>
          Compares each candidate&apos;s best submission per problem (same language) using
          structural fingerprints. High similarity is a signal for human review — not proof.
        </p>

        <div className="rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <label className="flex items-center gap-3 text-sm" style={{ color: "var(--foreground)" }}>
            Threshold: <span className="font-semibold" style={{ color: "var(--primary)" }}>{Math.round(threshold * 100)}%</span>
            <input type="range" min={0.4} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
          <button onClick={runScan} disabled={loading} className="ml-auto px-4 py-2 rounded-lg font-medium text-white inline-flex items-center gap-2 disabled:opacity-50" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
            <Play className="w-4 h-4" /> {loading ? "Scanning…" : "Run scan"}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
          </div>
        ) : ran ? (
          <>
            {scanned !== null && (
              <p className="text-sm mb-3" style={{ color: "var(--foreground-secondary)" }}>
                Scanned {scanned} best submissions · {pairs.length} pair(s) at or above {Math.round(threshold * 100)}%
                {truncated && " (showing top 200)"}
              </p>
            )}
            {pairs.length === 0 ? (
              <div className="rounded-xl p-12 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-secondary)" }} />
                <p style={{ color: "var(--foreground-secondary)" }}>No similar submission pairs above this threshold.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pairs.map((p, i) => (
                  <div key={i} className="rounded-xl p-4 flex items-center gap-4" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-center w-14 h-14 rounded-full flex-shrink-0" style={{ background: `${simColor(p.similarity)}22` }}>
                      <span className="font-bold text-sm" style={{ color: simColor(p.similarity) }}>{Math.round(p.similarity * 100)}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {p.candidateA.name} <span style={{ color: "var(--foreground-secondary)" }}>↔</span> {p.candidateB.name}
                      </div>
                      <div className="text-sm truncate" style={{ color: "var(--foreground-secondary)" }}>
                        {p.problem.title} · {p.language}
                      </div>
                    </div>
                    {p.similarity >= 0.85 && (
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#EF4444" }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl p-12 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <Code className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-secondary)" }} />
            <p style={{ color: "var(--foreground-secondary)" }}>Set a threshold and run a scan to find similar submissions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
