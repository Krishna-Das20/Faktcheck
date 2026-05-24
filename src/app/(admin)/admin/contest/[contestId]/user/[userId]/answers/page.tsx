"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { ArrowLeft, FileQuestion, Code, CheckCircle, XCircle } from "lucide-react";

export default function UserAnswerReviewPage() {
  const { contestId, userId } = useParams<{ contestId: string; userId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [mcqData, setMcqData] = useState<any>(null);
  const [codingData, setCodingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mcq" | "coding">("mcq");

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [mcqRes, codingRes] = await Promise.all([
          fetch(`/api/mcqs/contest/${contestId}/review?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/coding/contest/${contestId}/review?userId=${userId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const m = await mcqRes.json();
        const c = await codingRes.json();
        setMcqData(m);
        setCodingData(c);
      } catch { toast.error("Failed to load answers"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId, userId]);

  if (loading) return <div className="page-shell flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}><ArrowLeft className="w-5 h-5" /> Back</button>
        <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--foreground)" }}>User Answer Review</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {["mcq", "coding"].map((t) => (
            <button key={t} onClick={() => setTab(t as any)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: tab === t ? "var(--primary)" : "var(--background-secondary)", color: tab === t ? "#fff" : "var(--foreground-secondary)" }}>
              {t === "mcq" ? "MCQs" : "Coding"}
            </button>
          ))}
        </div>

        {tab === "mcq" && (
          <div className="space-y-4">
            {(mcqData?.mcqs || []).length === 0 ? (
              <p className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No MCQ answers found</p>
            ) : (mcqData.mcqs || []).map((mcq: any, i: number) => {
              const userAnswer = mcq.userAnswer;
              const isCorrect = mcq.isCorrect;
              return (
                <div key={i} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>Q{i + 1}</span>
                    {isCorrect ? <CheckCircle className="w-5 h-5" style={{ color: "#22C55E" }} /> : <XCircle className="w-5 h-5" style={{ color: "#EF4444" }} />}
                    <span className="text-sm" style={{ color: isCorrect ? "#22C55E" : "#EF4444" }}>{isCorrect ? "Correct" : "Incorrect"}</span>
                  </div>
                  <p className="mb-3" style={{ color: "var(--foreground)" }}>{typeof mcq.question === "object" ? mcq.question.text : mcq.question}</p>
                  <div className="space-y-1">
                    {mcq.options?.map((opt: any, j: number) => {
                      const optText = typeof opt === "object" ? opt.text : opt;
                      const isSelected = userAnswer === optText || (Array.isArray(userAnswer) && userAnswer.includes(optText));
                      const isCorrectOpt = opt.isCorrect;
                      return (
                        <div key={j} className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: isCorrectOpt ? "rgba(34,197,94,0.1)" : isSelected ? "rgba(239,68,68,0.1)" : "transparent" }}>
                          <span className="text-sm" style={{ color: isCorrectOpt ? "#22C55E" : isSelected ? "#EF4444" : "var(--foreground-secondary)" }}>
                            {String.fromCharCode(65 + j)}. {optText}
                          </span>
                          {isSelected && <span className="text-xs px-1 rounded" style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)" }}>User</span>}
                          {isCorrectOpt && <CheckCircle className="w-3 h-3" style={{ color: "#22C55E" }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "coding" && (
          <div className="space-y-4">
            {(codingData?.problems || []).length === 0 ? (
              <p className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No coding submissions found</p>
            ) : (codingData.problems || []).map((prob: any, i: number) => (
              <div key={i} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5" style={{ color: "#F97316" }} />
                    <span className="font-semibold" style={{ color: "var(--foreground)" }}>{prob.title}</span>
                    <span className="px-2 py-0.5 rounded text-xs" style={{ color: prob.difficulty === "EASY" ? "#22C55E" : prob.difficulty === "HARD" ? "#EF4444" : "#EAB308", background: "var(--background-secondary)" }}>{prob.difficulty}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: prob.verdict === "Accepted" ? "#22C55E" : "#EF4444" }}>{prob.verdict || "No submission"}</span>
                </div>
                {prob.language && <p className="text-sm mb-2" style={{ color: "var(--foreground-secondary)" }}>Language: {prob.language} · Score: {prob.score || 0}/{prob.maxScore || 0}</p>}
                {prob.code && (
                  <pre className="text-xs p-3 rounded-lg overflow-x-auto font-mono" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>{prob.code}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
