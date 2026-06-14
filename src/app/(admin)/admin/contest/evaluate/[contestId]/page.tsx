"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  Star,
  ExternalLink,
} from "lucide-react";

const inputStyle = {
  background: "var(--background-secondary)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
};

export default function EvaluateContestPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [contest, setContest] = useState<any>(null);
  const [forms, setForms] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<any>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluations, setEvaluations] = useState<
    Record<string, { manualScore: number; feedback: string }>
  >({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [contestRes, formsRes, submissionsRes] = await Promise.all([
        fetch(`/api/contests/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/forms/contest/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/form-submissions/contest/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const cData = await contestRes.json();
      const fData = await formsRes.json();
      const sData = await submissionsRes.json();
      setContest(cData.contest);
      setForms(fData.forms || []);
      setSubmissions(sData.submissions || []);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [contestId]);

  /* ───── Open a single submission detail (inline accordion) ───── */
  const toggleSubmission = async (submission: any) => {
    // If already expanded, collapse
    if (expandedId === submission._id) {
      setExpandedId(null);
      setExpandedSubmission(null);
      return;
    }

    try {
      const res = await fetch(`/api/form-submissions/${submission._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to load submission");
        return;
      }
      const sub = data.submission;
      setExpandedId(submission._id);
      setExpandedSubmission(sub);

      // Initialize evaluations with current values for manual fields
      const initialEvals: Record<string, { manualScore: number; feedback: string }> = {};
      sub.responses?.forEach((resp: any) => {
        if (!resp.isAutoScored) {
          initialEvals[resp.fieldId] = {
            manualScore: resp.manualScore || 0,
            feedback: resp.feedback || "",
          };
        }
      });
      setEvaluations(initialEvals);
    } catch {
      toast.error("Failed to load submission");
    }
  };

  /* ───── Score & Feedback handlers ───── */
  const handleScoreChange = (fieldId: string, score: number, maxMarks: number) => {
    setEvaluations((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        manualScore: Math.min(Math.max(0, score), maxMarks),
      },
    }));
  };

  const handleFeedbackChange = (fieldId: string, feedback: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        feedback,
      },
    }));
  };

  /* ───── Submit evaluation ───── */
  const submitEvaluation = async () => {
    if (!expandedSubmission) return;
    try {
      setEvaluating(true);
      const evalArray = Object.entries(evaluations).map(([fieldId, data]) => ({
        fieldId,
        manualScore: data.manualScore,
        feedback: data.feedback,
      }));

      const res = await fetch(
        `/api/form-submissions/${expandedSubmission._id}/evaluate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ evaluations: evalArray }),
        }
      );

      if (res.ok) {
        toast.success("Evaluation submitted successfully!");
        setExpandedId(null);
        setExpandedSubmission(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to submit evaluation");
      }
    } catch {
      toast.error("Failed to submit evaluation");
    } finally {
      setEvaluating(false);
    }
  };

  /* ───── Helpers ───── */
  const getFieldInfo = (fieldId: string, formId: any) => {
    const fId = typeof formId === "object" ? formId._id : formId;
    const form = forms.find((f) => f._id === fId);
    if (!form) return null;
    return form.fields?.find((f: any) => f.fieldId === fieldId) || null;
  };

  const evaluatedCount = submissions.filter((s) => s.isFullyEvaluated).length;
  const pendingCount = submissions.filter((s) => !s.isFullyEvaluated).length;

  /* ───── Loading state ───── */
  if (loading)
    return (
      <div className="page-shell flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderTopColor: "var(--primary)" }}
        />
      </div>
    );

  /* ───── Inline evaluation detail panel for a submission ───── */
  const renderEvaluationPanel = () => {
    if (!expandedSubmission) return null;

    return (
      <div
        className="mt-2 rounded-xl p-5"
        style={{
          background: "var(--background-card)",
          border: "1px solid var(--primary)",
          borderTop: "3px solid var(--primary)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Evaluate: {expandedSubmission.userId?.name}
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1" style={{ color: "#22C55E" }}>
              <CheckCircle className="w-4 h-4" /> Auto-scored
            </span>
            <span className="flex items-center gap-1" style={{ color: "#EAB308" }}>
              <Clock className="w-4 h-4" /> Manual evaluation
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {expandedSubmission.responses?.map((response: any) => {
            const field = getFieldInfo(
              response.fieldId,
              expandedSubmission.formId
            );
            const isAuto = response.isAutoScored;

            return (
              <div
                key={response.fieldId}
                className="p-5 rounded-lg"
                style={{
                  background: isAuto
                    ? "rgba(34,197,94,0.04)"
                    : "rgba(234,179,8,0.04)",
                  borderLeft: `4px solid ${isAuto ? "#22C55E" : "#EAB308"}`,
                }}
              >
                {/* Side-by-side grid: Question | Answer */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Question Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: isAuto
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(234,179,8,0.15)",
                          color: isAuto ? "#22C55E" : "#EAB308",
                        }}
                      >
                        {field?.type || "TEXT"}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        Max: {response.maxMarks} marks
                      </span>
                    </div>
                    <h4
                      className="font-semibold text-lg mb-2"
                      style={{ color: "var(--foreground)" }}
                    >
                      {field?.label || "Unknown Field"}
                    </h4>
                    {field?.placeholder && (
                      <p
                        className="text-sm italic"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        Hint: {field.placeholder}
                      </p>
                    )}
                    {(field?.type === "RADIO" || field?.type === "CHECKBOX") &&
                      field?.options?.length > 0 && (
                        <div className="mt-2">
                          <p
                            className="text-sm mb-1"
                            style={{ color: "var(--foreground-secondary)" }}
                          >
                            Options:
                          </p>
                          <ul className="text-sm pl-4 list-disc">
                            {field.options.map((opt: string, i: number) => (
                              <li
                                key={i}
                                style={{
                                  color: field.correctAnswers?.includes(opt)
                                    ? "#22C55E"
                                    : "var(--foreground-secondary)",
                                }}
                              >
                                {opt}{" "}
                                {field.correctAnswers?.includes(opt) && "✓"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>

                  {/* Right: Participant Answer + Scoring */}
                  <div
                    className="rounded-lg p-4"
                    style={{ background: "var(--background-secondary)" }}
                  >
                    <p
                      className="text-sm mb-2"
                      style={{ color: "var(--foreground-secondary)" }}
                    >
                      Participant&apos;s Answer:
                    </p>
                    <div
                      className="mb-4 p-3 rounded min-h-[60px]"
                      style={{
                        background: "var(--background)",
                        color: "var(--foreground)",
                      }}
                    >
                      {Array.isArray(response.value) ? (
                        response.value.join(", ")
                      ) : field?.type === "URL" && response.value ? (
                        <a
                          href={
                            response.value.startsWith("http")
                              ? response.value
                              : `https://${response.value}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline break-all flex items-center gap-1"
                          style={{ color: "var(--primary)" }}
                        >
                          {response.value}
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>
                      ) : (
                        response.value || (
                          <em style={{ color: "var(--foreground-secondary)" }}>
                            No response
                          </em>
                        )
                      )}
                    </div>

                    {/* Scoring Section */}
                    <div
                      className="pt-4"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      {isAuto ? (
                        <div className="flex items-center justify-between">
                          <span style={{ color: "var(--foreground-secondary)" }}>
                            Auto Score:
                          </span>
                          <span
                            className="font-bold text-lg"
                            style={{ color: "#22C55E" }}
                          >
                            {response.autoScore} / {response.maxMarks}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <span
                              style={{ color: "var(--foreground-secondary)" }}
                            >
                              Score:
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={response.maxMarks}
                              value={
                                evaluations[response.fieldId]?.manualScore ?? 0
                              }
                              onChange={(e) =>
                                handleScoreChange(
                                  response.fieldId,
                                  parseInt(e.target.value) || 0,
                                  response.maxMarks
                                )
                              }
                              className="w-24 px-3 py-2 rounded-lg text-center text-lg font-bold"
                              style={inputStyle}
                            />
                            <span
                              style={{ color: "var(--foreground-secondary)" }}
                            >
                              / {response.maxMarks}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={
                              evaluations[response.fieldId]?.feedback || ""
                            }
                            onChange={(e) =>
                              handleFeedbackChange(
                                response.fieldId,
                                e.target.value
                              )
                            }
                            placeholder="Add feedback for participant..."
                            className="w-full px-3 py-2 rounded-lg text-sm"
                            style={inputStyle}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div
          className="flex justify-end gap-3 mt-6 pt-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={() => {
              setExpandedId(null);
              setExpandedSubmission(null);
            }}
            className="px-5 py-2 rounded-xl font-semibold text-sm cursor-pointer"
            style={{
              background: "var(--background-secondary)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submitEvaluation}
            disabled={evaluating}
            className="px-5 py-2 rounded-xl text-white font-semibold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            <Send className="w-4 h-4" />
            {evaluating ? "Submitting..." : "Submit Evaluation"}
          </button>
        </div>
      </div>
    );
  };

  /* ───── Main UI ───── */
  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--foreground-secondary)" }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1
              className="text-2xl font-bold flex items-center gap-3"
              style={{ color: "var(--foreground)" }}
            >
              <Star className="w-8 h-8" style={{ color: "#EAB308" }} />
              Form Evaluations
            </h1>
            <p style={{ color: "var(--foreground-secondary)" }}>
              {contest?.title}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: "var(--background-card)",
              border: "1px solid var(--border)",
            }}
          >
            <FileText className="w-8 h-8" style={{ color: "var(--primary)" }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {submissions.length}
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                Total Submissions
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: "var(--background-card)",
              border: "1px solid var(--border)",
            }}
          >
            <CheckCircle className="w-8 h-8" style={{ color: "#22C55E" }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {evaluatedCount}
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                Evaluated
              </div>
            </div>
          </div>
          <div
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{
              background: "var(--background-card)",
              border: "1px solid var(--border)",
            }}
          >
            <Clock className="w-8 h-8" style={{ color: "#EAB308" }} />
            <div>
              <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                {pendingCount}
              </div>
              <div className="text-sm" style={{ color: "var(--foreground-secondary)" }}>
                Pending
              </div>
            </div>
          </div>
        </div>

        {/* Submissions List with Inline Evaluation */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Submissions
          </h2>

          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: "var(--foreground-secondary)" }}
              />
              <p style={{ color: "var(--foreground-secondary)" }}>
                No form submissions yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub) => (
                <div key={sub._id}>
                  {/* Participant Row */}
                  <div
                    className="flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors"
                    style={{
                      background:
                        expandedId === sub._id
                          ? "rgba(255,107,53,0.1)"
                          : "var(--background-secondary)",
                      border:
                        expandedId === sub._id
                          ? "1px solid var(--primary)"
                          : "1px solid transparent",
                    }}
                    onClick={() => toggleSubmission(sub)}
                  >
                    <div className="flex items-center gap-3">
                      <User
                        className="w-5 h-5"
                        style={{ color: "var(--foreground-secondary)" }}
                      />
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {sub.userId?.name || "Unknown"}
                        </div>
                        <div
                          className="text-sm"
                          style={{ color: "var(--foreground-secondary)" }}
                        >
                          {sub.userId?.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div
                          className="font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {sub.totalScore || 0} / {sub.maxPossibleScore || 0}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "var(--foreground-secondary)" }}
                        >
                          Auto: {sub.totalAutoScore || 0} | Manual:{" "}
                          {sub.totalManualScore || 0}
                        </div>
                      </div>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: sub.isFullyEvaluated
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(234,179,8,0.15)",
                          color: sub.isFullyEvaluated ? "#22C55E" : "#EAB308",
                        }}
                      >
                        {sub.isFullyEvaluated ? "Evaluated" : "Pending"}
                      </span>
                      {expandedId === sub._id ? (
                        <ChevronUp
                          className="w-5 h-5"
                          style={{ color: "var(--foreground-secondary)" }}
                        />
                      ) : (
                        <ChevronDown
                          className="w-5 h-5"
                          style={{ color: "var(--foreground-secondary)" }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Inline Evaluation Panel — renders directly below this participant */}
                  {expandedId === sub._id && renderEvaluationPanel()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
