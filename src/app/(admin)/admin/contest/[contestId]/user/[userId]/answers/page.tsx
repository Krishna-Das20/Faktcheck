"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  ArrowLeft, FileText, Code, CheckCircle, XCircle, Trophy,
  Clock, ChevronDown, ChevronRight, Copy, Check, Terminal, MinusCircle,
} from "lucide-react";

const formatTime = (seconds: number | null | undefined) => {
  if (!seconds) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function UserAnswerReviewPage() {
  const { contestId, userId } = useParams<{ contestId: string; userId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [contest, setContest] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"mcq" | "coding">("mcq");
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});
  const [sourceCodeCache, setSourceCodeCache] = useState<Record<string, any>>({});
  const [loadingCode, setLoadingCode] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: any = { Authorization: `Bearer ${token}` };
        const [detailsRes, contestRes] = await Promise.all([
          fetch(`/api/leaderboard/${contestId}/user/${userId}/details`, { headers }),
          fetch(`/api/contests/${contestId}`, { headers }).catch(() => null),
        ]);
        const detailsData = await detailsRes.json();
        setUserDetails(detailsData.userDetails || null);

        if (contestRes && contestRes.ok) {
          const contestData = await contestRes.json();
          setContest(contestData.contest || null);
        }
      } catch {
        toast.error("Failed to load answer review data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [contestId, userId, token]);

  const toggleSubmission = async (submissionId: string) => {
    if (!submissionId) return;

    setExpandedSubmissions((prev) => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));

    // Fetch source code if not cached
    if (!sourceCodeCache[submissionId] && !loadingCode[submissionId]) {
      setLoadingCode((prev) => ({ ...prev, [submissionId]: true }));
      try {
        const res = await fetch(`/api/submissions/${submissionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSourceCodeCache((prev) => ({
          ...prev,
          [submissionId]: data.submission,
        }));
      } catch {
        toast.error("Failed to load source code");
      } finally {
        setLoadingCode((prev) => ({ ...prev, [submissionId]: false }));
      }
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "ACCEPTED": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "WRONG_ANSWER": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "TIME_LIMIT_EXCEEDED": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "RUNTIME_ERROR": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "COMPILATION_ERROR": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!userDetails) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Failed to load user details</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-400 hover:text-primary-300">
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  const mcqAnswers = userDetails.mcqAnswerDetails || [];
  const mcqCorrect = mcqAnswers.filter((q: any) => q.isCorrect).length;
  const mcqUnanswered = mcqAnswers.filter((q: any) => q.unanswered).length;
  const mcqTotal = mcqAnswers.length;
  const codingProblems = userDetails.codingAnswerDetails || [];
  const codingSolved = codingProblems.filter((p: any) => p.solved).length;
  const codingUnanswered = codingProblems.filter((p: any) => p.unanswered).length;
  const codingTotal = codingProblems.length;

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-dark-900 border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Leaderboard
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {userDetails.user?.name || "Unknown User"}
              </h1>
              <p className="text-gray-400 mt-1">
                {userDetails.user?.email} • {contest?.title || "Contest"}
              </p>
            </div>

            {/* Score Summary */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">MCQ Score</p>
                <p className="text-xl font-bold text-blue-400">{userDetails.mcqScore}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Coding Score</p>
                <p className="text-xl font-bold text-green-400">{userDetails.codingScore}</p>
              </div>
              <div className="text-center border-l border-dark-700 pl-4 sm:pl-6">
                <p className="text-xs text-gray-500 uppercase">Total</p>
                <p className="text-xl font-bold text-primary-400">{userDetails.totalScore}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase">Time</p>
                <p className="text-xl font-bold text-gray-300">{formatTime(userDetails.totalTimeSpent)}</p>
              </div>
              {userDetails.rank && (
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase">Rank</p>
                  <p className="text-xl font-bold text-yellow-400">#{userDetails.rank}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            <button
              onClick={() => setActiveTab("mcq")}
              className={`px-5 py-2.5 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "mcq"
                  ? "bg-dark-950 text-blue-400 border-t-2 border-blue-400"
                  : "text-gray-400 hover:text-gray-300 hover:bg-dark-800/50"
              }`}
            >
              <FileText className="w-4 h-4" />
              MCQ Answers
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === "mcq" ? "bg-blue-500/20 text-blue-400" : "bg-dark-700 text-gray-500"
              }`}>
                {mcqCorrect}/{mcqTotal}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("coding")}
              className={`px-5 py-2.5 rounded-t-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "coding"
                  ? "bg-dark-950 text-green-400 border-t-2 border-green-400"
                  : "text-gray-400 hover:text-gray-300 hover:bg-dark-800/50"
              }`}
            >
              <Code className="w-4 h-4" />
              Coding Submissions
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === "coding" ? "bg-green-500/20 text-green-400" : "bg-dark-700 text-gray-500"
              }`}>
                {codingSolved}/{codingTotal}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* MCQ Tab */}
        {activeTab === "mcq" && (
          <div className="space-y-4">
            {mcqAnswers.length === 0 ? (
              <div className="bg-dark-900 rounded-xl p-12 text-center">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No MCQ answers recorded</p>
              </div>
            ) : (
              mcqAnswers.map((q: any, i: number) => (
                <div
                  key={i}
                  className={`bg-dark-900 rounded-xl border overflow-hidden ${
                    q.unanswered ? "border-amber-500/20" : q.isCorrect ? "border-green-500/20" : "border-red-500/20"
                  }`}
                >
                  {/* Question Header */}
                  <div className={`px-4 sm:px-6 py-4 border-b ${
                    q.unanswered
                      ? "border-amber-500/10 bg-amber-500/5"
                      : q.isCorrect
                        ? "border-green-500/10 bg-green-500/5"
                        : "border-red-500/10 bg-red-500/5"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-gray-500 font-mono text-sm mt-0.5 shrink-0">
                          Q{i + 1}
                        </span>
                        <p className="text-gray-200">{q.questionText}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-2 sm:ml-4 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded ${
                          q.unanswered
                            ? "bg-amber-500/20 text-amber-400"
                            : q.isCorrect
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                        }`}>
                          {q.category}
                        </span>
                        {q.unanswered ? (
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <MinusCircle className="w-5 h-5" />
                            Unanswered
                          </span>
                        ) : q.isCorrect ? (
                          <span className="flex items-center gap-1 text-green-400 font-semibold">
                            <CheckCircle className="w-5 h-5" />
                            +{q.marksAwarded}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 font-semibold">
                            <XCircle className="w-5 h-5" />
                            {q.marksAwarded}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(q.options || []).map((opt: any, j: number) => (
                      <div
                        key={j}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                          opt.isCorrect && opt.wasSelected
                            ? "bg-green-500/15 border-green-500/40 text-green-300"
                            : opt.isCorrect
                              ? "bg-green-500/5 border-green-500/20 text-green-400/80"
                              : opt.wasSelected
                                ? "bg-red-500/15 border-red-500/40 text-red-300"
                                : "bg-dark-800/30 border-dark-700/50 text-gray-400"
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          opt.isCorrect
                            ? "bg-green-500/30 text-green-400"
                            : opt.wasSelected
                              ? "bg-red-500/30 text-red-400"
                              : "bg-dark-700 text-gray-500"
                        }`}>
                          {String.fromCharCode(65 + j)}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {opt.isCorrect && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                        {opt.wasSelected && !opt.isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Coding Tab */}
        {activeTab === "coding" && (
          <div className="space-y-6">
            {codingProblems.length === 0 ? (
              <div className="bg-dark-900 rounded-xl p-12 text-center">
                <Code className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No coding submissions recorded</p>
              </div>
            ) : (
              codingProblems.map((problem: any, i: number) => (
                <div key={i} className={`bg-dark-900 rounded-xl border overflow-hidden ${
                  problem.unanswered ? "border-amber-500/20" : "border-dark-800"
                }`}>
                  {/* Problem Header */}
                  <div className={`px-4 sm:px-6 py-4 border-b border-dark-800 ${
                    problem.unanswered ? "bg-amber-500/5" : problem.solved ? "bg-green-500/5" : "bg-dark-850"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-gray-500 font-mono text-sm">P{i + 1}</span>
                        <h3 className="text-base sm:text-lg font-semibold text-white truncate">{problem.title}</h3>
                        <span className="text-xs px-2 py-1 rounded bg-dark-700 text-gray-400 shrink-0">
                          {problem.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {problem.unanswered ? (
                          <span className="flex items-center gap-2 text-amber-400 font-semibold">
                            <MinusCircle className="w-6 h-6" />
                            Not Attempted
                          </span>
                        ) : (
                          <>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                problem.bestScore >= problem.maxScore ? "text-green-400" : "text-yellow-400"
                              }`}>
                                {problem.bestScore}/{problem.maxScore}
                              </p>
                              <p className="text-xs text-gray-500">
                                {problem.totalAttempts} attempt{problem.totalAttempts !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {problem.solved ? (
                              <CheckCircle className="w-6 h-6 text-green-400" />
                            ) : (
                              <XCircle className="w-6 h-6 text-yellow-500" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submissions List */}
                  <div className="divide-y divide-dark-800">
                    {(problem.submissions || []).map((sub: any, j: number) => {
                      const subId = sub.submissionId || `${problem.problemId}-${j}`;
                      const isExpanded = expandedSubmissions[subId];
                      const cachedSub = sourceCodeCache[subId];
                      const isLoadingCode = loadingCode[subId];

                      return (
                        <div key={j} className="group">
                          {/* Submission Row */}
                          <div
                            className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-dark-800/30 transition-colors gap-2"
                            onClick={() => sub.submissionId && toggleSubmission(sub.submissionId)}
                          >
                            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                              {sub.submissionId ? (
                                isExpanded ?
                                  <ChevronDown className="w-4 h-4 text-gray-500" /> :
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                              ) : (
                                <span className="w-4 h-4" />
                              )}
                              <span className="text-gray-500 font-mono text-sm">#{j + 1}</span>
                              <span className={`px-2.5 py-1 rounded text-xs font-medium border ${getVerdictColor(sub.verdict)}`}>
                                {sub.verdict?.replace(/_/g, " ")}
                              </span>
                              <span className="text-gray-400 text-sm px-2 py-0.5 bg-dark-700/50 rounded">
                                {sub.language}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 sm:gap-6 text-sm flex-wrap">
                              <span className="text-gray-400">
                                {sub.testcasesPassed}/{sub.totalTestcases} testcases
                              </span>
                              <span className="text-gray-300 font-mono font-semibold">
                                {sub.score} pts
                              </span>
                              <span className="text-gray-500 text-xs">
                                {new Date(sub.submittedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Source Code */}
                          {isExpanded && sub.submissionId && (
                            <div className="px-4 sm:px-6 pb-4">
                              {isLoadingCode ? (
                                <div className="flex items-center justify-center py-6">
                                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500" />
                                </div>
                              ) : cachedSub ? (
                                <div className="bg-dark-950 rounded-lg border border-dark-700 overflow-hidden">
                                  {/* Code Header */}
                                  <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-dark-700">
                                    <div className="flex items-center gap-2">
                                      <Terminal className="w-4 h-4 text-gray-500" />
                                      <span className="text-xs text-gray-400">
                                        {cachedSub.language} • {cachedSub.verdict}
                                      </span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyCode(cachedSub.sourceCode, sub.submissionId);
                                      }}
                                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                                    >
                                      {copiedId === sub.submissionId ? (
                                        <><Check className="w-3.5 h-3.5 text-green-400" /> Copied</>
                                      ) : (
                                        <><Copy className="w-3.5 h-3.5" /> Copy</>
                                      )}
                                    </button>
                                  </div>
                                  {/* Code Content */}
                                  <pre className="p-4 text-sm text-gray-300 overflow-x-auto max-h-96">
                                    <code>{cachedSub.sourceCode}</code>
                                  </pre>
                                </div>
                              ) : (
                                <p className="text-gray-500 text-sm text-center py-4">
                                  Failed to load source code
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
