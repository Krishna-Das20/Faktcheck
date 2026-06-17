"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowLeft, CheckCircle, XCircle, Minus, Trophy, FileText,
  ChevronLeft, ChevronRight, ClipboardList, Clock, Mail, Code,
} from "lucide-react";

export default function ContestReviewPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState("mcq");
  const [mcqReview, setMcqReview] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [contest, setContest] = useState<any>(null);
  const [codingReview, setCodingReview] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviewData = async () => {
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [mcqRes, resultRes, contestRes, codingRes, formsRes] = await Promise.all([
          fetch(`/api/mcqs/contest/${contestId}/review`, { headers }).then((r) => r.json()).catch(() => ({ review: [] })),
          fetch(`/api/leaderboard/${contestId}/rank`, { headers }).then((r) => r.json()).catch(() => ({ result: null })),
          fetch(`/api/contests/${contestId}`, { headers }).then((r) => r.json()).catch(() => ({ contest: null })),
          fetch(`/api/coding/contest/${contestId}/review`, { headers }).then((r) => r.json()).catch(() => ({ review: [] })),
          fetch(`/api/form-submissions/my/${contestId}`, { headers }).then((r) => r.json()).catch(() => ({ submissions: [] })),
        ]);

        setMcqReview(mcqRes.review || []);
        setResult(resultRes.result);
        setContest(contestRes.contest);
        setCodingReview(codingRes.review || []);
        setFormSubmissions(formsRes.submissions || []);
      } catch {
        toast.error("Failed to load review data");
      }
      setLoading(false);
    };
    fetchReviewData();
  }, [contestId, token]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  const hasMCQ = contest?.sections?.mcq?.enabled && mcqReview.length > 0;
  const hasForms = contest?.sections?.forms?.enabled && formSubmissions.length > 0;
  const hasCoding = contest?.sections?.coding?.enabled && codingReview.length > 0;

  const currentMCQ = mcqReview[currentQuestion];
  const userAnswer = currentMCQ?.userAnswer || [];
  const correctAnswers = currentMCQ?.correctAnswers || [];
  const isCorrect = currentMCQ?.isCorrect;
  const isUnanswered = userAnswer.length === 0;

  const correctCount = mcqReview.filter((m) => m.isCorrect).length;
  const wrongCount = mcqReview.filter((m) => !m.isCorrect && m.userAnswer?.length > 0).length;
  const unansweredCount = mcqReview.filter((m) => !m.userAnswer || m.userAnswer.length === 0).length;

  const verdictColors: Record<string, string> = {
    ACCEPTED: "text-green-400 bg-green-500/10",
    WRONG_ANSWER: "text-red-400 bg-red-500/10",
    TIME_LIMIT_EXCEEDED: "text-yellow-400 bg-yellow-500/10",
    RUNTIME_ERROR: "text-orange-400 bg-orange-500/10",
    COMPILATION_ERROR: "text-purple-400 bg-purple-500/10",
    NOT_ATTEMPTED: "text-muted-ui bg-gray-500/10",
  };

  return (
    <div className="page-shell">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 mb-4 transition-colors"
            style={{ color: "var(--foreground-secondary)" }}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
            Review Your Answers
          </h1>
          <p className="text-sm sm:text-base" style={{ color: "var(--foreground-secondary)" }}>See how you performed in the contest</p>
        </div>

        {/* Tab Toggle */}
        {(hasMCQ || hasForms || hasCoding) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {hasMCQ && (
              <button
                onClick={() => setActiveTab("mcq")}
                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all"
                style={{
                  background: activeTab === "mcq" ? "var(--primary)" : "var(--background-secondary)",
                  color: activeTab === "mcq" ? "white" : "var(--foreground-secondary)",
                }}
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" /> MCQ Section
              </button>
            )}
            {hasForms && (
              <button
                onClick={() => setActiveTab("forms")}
                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all"
                style={{
                  background: activeTab === "forms" ? "var(--primary)" : "var(--background-secondary)",
                  color: activeTab === "forms" ? "white" : "var(--foreground-secondary)",
                }}
              >
                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" /> Forms Section
              </button>
            )}
            {hasCoding && (
              <button
                onClick={() => setActiveTab("coding")}
                className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all"
                style={{
                  background: activeTab === "coding" ? "var(--primary)" : "var(--background-secondary)",
                  color: activeTab === "coding" ? "white" : "var(--foreground-secondary)",
                }}
              >
                <Code className="w-4 h-4 sm:w-5 sm:h-5" /> Coding Section
              </button>
            )}
          </div>
        )}

        {/* MCQ Review */}
        {activeTab === "mcq" && hasMCQ && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="rounded-xl p-4 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{result?.mcqScore || 0}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>MCQ Score</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                <p className="text-2xl font-bold" style={{ color: "#22C55E" }}>{correctCount}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Correct</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(239,68,68,0.1)" }}>
                <p className="text-2xl font-bold" style={{ color: "#EF4444" }}>{wrongCount}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Wrong</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "var(--background-secondary)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground-secondary)" }}>{unansweredCount}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Unanswered</p>
              </div>
            </div>

            {/* Question Review */}
            {currentMCQ && (
              <div className="rounded-xl p-6 mb-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg text-sm font-semibold text-white" style={{ background: "var(--primary)" }}>Q{currentQuestion + 1}</span>
                    <span className="px-2 py-1 rounded text-xs" style={{ background: "var(--background-secondary)", color: "var(--foreground-secondary)" }}>{currentMCQ.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUnanswered ? (
                      <span className="flex items-center gap-1" style={{ color: "var(--foreground-secondary)" }}><Minus className="w-5 h-5" /> Unanswered</span>
                    ) : isCorrect ? (
                      <span className="flex items-center gap-1" style={{ color: "#22C55E" }}><CheckCircle className="w-5 h-5" /> Correct</span>
                    ) : (
                      <span className="flex items-center gap-1" style={{ color: "#EF4444" }}><XCircle className="w-5 h-5" /> Wrong</span>
                    )}
                  </div>
                </div>

                <p className="text-lg leading-relaxed whitespace-pre-wrap mb-6" style={{ color: "var(--foreground)" }}>
                  {typeof currentMCQ.question === "object" ? currentMCQ.question.text : currentMCQ.question}
                </p>

                {currentMCQ.imageUrl && (
                  <img src={currentMCQ.imageUrl} alt="Question" className="max-w-full max-h-80 rounded-lg mb-6" style={{ border: "1px solid var(--border)" }} />
                )}

                <div className="space-y-3">
                  {currentMCQ.options?.map((option: any, index: number) => {
                    const isUserSelected = userAnswer.includes(index);
                    const isCorrectAnswer = correctAnswers.includes(index);
                    const optionLabel = String.fromCharCode(65 + index);

                    let borderColor = "var(--border)";
                    let bgColor = "var(--background-secondary)";
                    let icon = null;

                    if (isCorrectAnswer) {
                      borderColor = "#22C55E";
                      bgColor = "rgba(34,197,94,0.1)";
                      icon = <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#22C55E" }} />;
                    } else if (isUserSelected && !isCorrectAnswer) {
                      borderColor = "#EF4444";
                      bgColor = "rgba(239,68,68,0.1)";
                      icon = <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#EF4444" }} />;
                    }

                    return (
                      <div key={index} className="p-4 rounded-lg transition-all" style={{ border: `1px solid ${borderColor}`, background: bgColor }}>
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-1 rounded text-sm font-semibold" style={{ background: "var(--background)", color: "var(--foreground-secondary)" }}>{optionLabel}</span>
                          <span className="flex-grow" style={{ color: "var(--foreground)" }}>{typeof option === "object" ? option.text : option}</span>
                          {icon}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {currentMCQ.explanation && (
                  <div className="mt-4 p-4 rounded-lg" style={{ border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.05)" }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#3B82F6" }}>💡 Explanation</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground-secondary)" }}>{currentMCQ.explanation}</p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))} disabled={currentQuestion === 0} className="px-4 py-2 rounded-lg disabled:opacity-50 transition-colors" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                    <ChevronLeft className="w-5 h-5 inline mr-1" /> Previous
                  </button>
                  <span style={{ color: "var(--foreground-secondary)" }}>{currentQuestion + 1} / {mcqReview.length}</span>
                  <button onClick={() => setCurrentQuestion((p) => Math.min(mcqReview.length - 1, p + 1))} disabled={currentQuestion === mcqReview.length - 1} className="px-4 py-2 rounded-lg disabled:opacity-50 transition-colors" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
                    Next <ChevronRight className="w-5 h-5 inline ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* Question Grid */}
            <div className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Question Overview</h3>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {mcqReview.map((mcq, index) => {
                  const answered = mcq.userAnswer?.length > 0;
                  const correct = mcq.isCorrect;
                  const isCurrent = index === currentQuestion;

                  let bg = "var(--background-secondary)";
                  let color = "var(--foreground-secondary)";
                  if (answered) {
                    bg = correct ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
                    color = correct ? "#22C55E" : "#EF4444";
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => setCurrentQuestion(index)}
                      className="w-10 h-10 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        background: bg,
                        color,
                        outline: isCurrent ? "2px solid var(--primary)" : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Forms Review */}
        {activeTab === "forms" && hasForms && (
          <div className="space-y-6">
            {formSubmissions.map((submission: any) => {
              const isPending = !submission.isFullyEvaluated;
              const form = submission.formId;

              return (
                <div key={submission._id} className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-6 h-6" style={{ color: "var(--primary)" }} />
                      <h3 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>{form?.title || "Form"}</h3>
                    </div>
                    {isPending ? (
                      <span className="flex items-center gap-2 px-3 py-1 rounded-lg text-sm" style={{ background: "rgba(234,179,8,0.2)", color: "#EAB308" }}>
                        <Clock className="w-4 h-4" />
                        Under Evaluation
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 px-3 py-1 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.2)", color: "#22C55E" }}>
                        <CheckCircle className="w-4 h-4" />
                        Evaluated
                      </span>
                    )}
                  </div>

                  {isPending ? (
                    <div className="rounded-lg p-6 text-center" style={{ background: "var(--background-secondary)" }}>
                      <Clock className="w-12 h-12 mx-auto mb-3" style={{ color: "#EAB308" }} />
                      <h4 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>Awaiting Evaluation</h4>
                      <p className="mb-4" style={{ color: "var(--foreground-secondary)" }}>
                        Your form submission is being reviewed by the evaluator.
                        Results will be available once evaluation is complete.
                      </p>
                      <span className="flex items-center justify-center gap-2" style={{ color: "#22C55E" }}>
                        <Mail className="w-4 h-4" />
                        You will be notified via email when reviewed
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Score Summary */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="rounded-lg p-4 text-center" style={{ background: "var(--background-secondary)" }}>
                          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{submission.totalScore}</p>
                          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Total Score</p>
                        </div>
                        <div className="rounded-lg p-4 text-center" style={{ background: "var(--background-secondary)" }}>
                          <p className="text-2xl font-bold" style={{ color: "#22C55E" }}>{submission.totalAutoScore}</p>
                          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Auto Score</p>
                        </div>
                        <div className="rounded-lg p-4 text-center" style={{ background: "var(--background-secondary)" }}>
                          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{submission.totalManualScore}</p>
                          <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Manual Score</p>
                        </div>
                      </div>

                      {/* Individual Responses */}
                      <div className="space-y-3">
                        {submission.responses?.map((response: any, idx: number) => {
                          const field = form?.fields?.find((f: any) => f.fieldId === response.fieldId);
                          const score = response.isAutoScored ? response.autoScore : response.manualScore;

                          return (
                            <div key={response.fieldId} className="p-4 rounded-lg" style={{ background: "var(--background-secondary)" }}>
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium" style={{ color: "var(--foreground)" }}>{field?.label || `Field ${idx + 1}`}</span>
                                <span className="text-sm" style={{ color: score > 0 ? "#22C55E" : "var(--foreground-secondary)" }}>
                                  {score || 0} / {response.maxMarks}
                                </span>
                              </div>
                              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                                {Array.isArray(response.value) ? response.value.join(", ") : response.value || "No answer"}
                              </p>
                              {response.feedback && (
                                <p className="text-sm mt-2 italic" style={{ color: "var(--primary)" }}>
                                  Feedback: {response.feedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Coding Review */}
        {activeTab === "coding" && hasCoding && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl p-4 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{result?.codingScore || 0}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Coding Score</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                <p className="text-2xl font-bold" style={{ color: "#22C55E" }}>{codingReview.filter((r) => r.bestVerdict === "ACCEPTED").length}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Accepted</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{codingReview.length}</p>
                <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Total Problems</p>
              </div>
            </div>

            {codingReview.map((item) => {
              const colorClass = verdictColors[item.bestVerdict] || "text-muted-ui bg-gray-500/10";
              return (
                <div key={item.problem._id} className="rounded-xl p-5" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold truncate" style={{ color: "var(--foreground)" }}>{item.problem.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        <span className={`text-sm ${item.problem.difficulty === "EASY" ? "text-green-400" : item.problem.difficulty === "MEDIUM" ? "text-yellow-400" : "text-red-400"}`}>{item.problem.difficulty}</span>
                        <span style={{ color: "var(--foreground-secondary)" }}>•</span>
                        <span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{item.problem.marks} marks</span>
                        {item.language && (<><span style={{ color: "var(--foreground-secondary)" }}>•</span><span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{item.language}</span></>)}
                        {item.submissionCount > 0 && (<><span style={{ color: "var(--foreground-secondary)" }}>•</span><span className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{item.submissionCount} submission{item.submissionCount !== 1 ? "s" : ""}</span></>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.bestVerdict === "ACCEPTED" && <span className="text-sm font-medium" style={{ color: "#22C55E" }}>{item.bestScore} pts</span>}
                      <span className={`px-3 py-1 rounded-lg text-sm font-medium ${colorClass}`}>{item.bestVerdict.replace(/_/g, " ")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Data */}
        {!hasMCQ && !hasCoding && !hasForms && (
          <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--foreground-secondary)" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>No Review Data</h2>
            <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>Review data is not available yet.</p>
            <Link href={`/leaderboard/${contestId}`} className="px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
              View Leaderboard
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
          <Link href={`/leaderboard/${contestId}`} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold" style={{ background: "linear-gradient(135deg, var(--primary), #FF8C5A)" }}>
            <Trophy className="w-5 h-5" /> View Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
