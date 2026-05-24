"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useContestTimer } from "@/context/ContestTimerContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Clock,
  FileText,
  Code,
  Send,
  ArrowLeft,
  CheckCircle,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ContestHubPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const {
    formattedTime,
    remainingTime,
    isStarted,
    progress,
    contest,
    loading,
    finalSubmit,
  } = useContestTimer();

  const [mcqProgress, setMcqProgress] = useState({ answered: 0, total: 0 });
  const [codingProgress, setCodingProgress] = useState({
    submitted: 0,
    total: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch section progress on mount
  useEffect(() => {
    const fetchSectionProgress = async () => {
      try {
        // MCQ progress from localStorage
        const mcqAnswers = JSON.parse(
          localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
        );

        // Get total MCQ count from server
        const mcqRes = await fetch(`/api/mcqs/contest/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mcqData = await mcqRes.json();
        setMcqProgress({
          answered: Object.keys(mcqAnswers).length,
          total: mcqData.mcqs?.length || 0,
        });

        // Coding progress
        const codingRes = await fetch(
          `/api/coding/contest/${contestId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const codingData = await codingRes.json();
        setCodingProgress({
          submitted: 0, // Will be updated when coding section is built
          total: codingData.problems?.length || 0,
        });
      } catch {
        console.error("Error fetching progress");
      }
    };

    if (contestId && isStarted && token) {
      fetchSectionProgress();
    }
  }, [contestId, isStarted, token]);

  const handleFinalSubmit = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to submit the contest? You cannot make changes after submission."
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const mcqAnswers = JSON.parse(
        localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
      );
      const formattedAnswers = Object.entries(mcqAnswers).map(
        ([mcqId, selectedOptions]) => ({ mcqId, selectedOptions })
      );
      await finalSubmit(formattedAnswers);

      // Clear all localStorage for this contest
      Object.keys(localStorage).forEach((key) => {
        if (key.includes(contestId)) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      console.error("Submit error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveContest = async () => {
    const confirmed = window.confirm(
      "Warning: You have an active contest!\n\nLeaving will AUTO-SUBMIT your contest with current progress.\n\nAre you sure?"
    );
    if (confirmed) {
      try {
        const mcqAnswers = JSON.parse(
          localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
        );
        const formattedAnswers = Object.entries(mcqAnswers).map(
          ([mcqId, selectedOptions]) => ({ mcqId, selectedOptions })
        );
        await finalSubmit(formattedAnswers);
      } catch {
        router.push(`/contests/${contestId}`);
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
          style={{ borderTopColor: "var(--primary)" }}
        />
      </div>
    );
  }

  // Contest ended
  if (contest?.status === "ENDED") {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div
          className="text-center rounded-2xl p-8 max-w-md"
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
          }}
        >
          <Clock
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: "var(--foreground-muted)" }}
          />
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Contest Has Ended
          </h2>
          <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
            This contest has already ended.
          </p>
          <div className="space-y-3">
            <Link
              href={`/leaderboard/${contestId}`}
              className="block w-full py-3 rounded-xl text-center font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), #FF8C5A)",
              }}
            >
              View Leaderboard
            </Link>
            <Link
              href="/contests"
              className="block w-full py-3 rounded-xl text-center font-semibold"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              Browse Other Contests
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not started
  if (!isStarted) {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Contest not started
          </h2>
          <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
            Please start the contest from the contest details page.
          </p>
          <Link
            href={`/contests/${contestId}`}
            className="inline-block px-6 py-3 rounded-xl text-white font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--primary), #FF8C5A)",
            }}
          >
            Go to Contest
          </Link>
        </div>
      </div>
    );
  }

  // Already submitted
  if (
    progress?.status === "SUBMITTED" ||
    progress?.status === "TIMED_OUT"
  ) {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div
          className="text-center rounded-2xl p-8 max-w-md"
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
          }}
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Contest Already Submitted
          </h2>
          <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
            You have already submitted. You cannot enter again.
          </p>
          <div className="space-y-3">
            <Link
              href={`/leaderboard/${contestId}`}
              className="block w-full py-3 rounded-xl text-center font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), #FF8C5A)",
              }}
            >
              View Leaderboard
            </Link>
            <Link
              href={`/contest/${contestId}/review`}
              className="block w-full py-3 rounded-xl text-center font-semibold"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              Review Your Answers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
     
    >
      {/* Header — no timer here, timer is inside each section */}
      <div
        className="sticky top-0 z-50"
        style={{
          background: "var(--background-card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={handleLeaveContest}
                className="flex-shrink-0 transition-colors"
                style={{ color: "var(--foreground-secondary)" }}
                aria-label="Leave contest"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1
                className="text-base sm:text-xl font-bold truncate"
                style={{ color: "var(--foreground)" }}
              >
                {contest?.title || "Contest"}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2
            className="text-3xl font-bold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Contest Hub
          </h2>
          <p style={{ color: "var(--foreground-secondary)" }}>
            Choose a section to continue
          </p>
        </div>

        {/* Section Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* MCQ Section */}
          {contest?.sections?.mcq?.enabled && (
            <button
              onClick={() =>
                router.push(`/contest/${contestId}/mcq`)
              }
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:translate-y-[-2px] group"
              style={{
                background: "var(--background-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "rgba(255,107,53,0.2)" }}
                >
                  <FileText
                    className="w-8 h-8"
                    style={{ color: "var(--primary)" }}
                  />
                </div>
                <div>
                  <h3
                    className="text-xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    MCQ Section
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    Multiple Choice Questions
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    Progress
                  </span>
                  <span style={{ color: "var(--primary)" }}>
                    {mcqProgress.answered} answered
                  </span>
                </div>
                <div
                  className="w-full rounded-full h-2"
                  style={{ background: "var(--background-secondary)" }}
                >
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        mcqProgress.total > 0
                          ? (mcqProgress.answered / mcqProgress.total) *
                            100
                          : 0
                      }%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {contest.sections.mcq.hasTimer && contest.sections.mcq.duration > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ background: "rgba(255,107,53,0.15)", color: "var(--primary)" }}>
                      <Clock className="w-3 h-3" />
                      {contest.sections.mcq.duration} min
                    </span>
                  )}
                </div>
                <span
                  className="group-hover:translate-x-2 transition-transform"
                  style={{ color: "var(--primary)" }}
                >
                  Continue →
                </span>
              </div>
            </button>
          )}

          {/* Coding Section */}
          {contest?.sections?.coding?.enabled && (
            <button
              onClick={() =>
                router.push(`/contest/${contestId}/coding`)
              }
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:translate-y-[-2px] group"
              style={{
                background: "var(--background-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "rgba(34, 197, 94, 0.2)" }}
                >
                  <Code className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3
                    className="text-xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Coding Section
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    Programming Problems
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    Progress
                  </span>
                  <span className="text-green-400">
                    {codingProgress.submitted} submitted
                  </span>
                </div>
                <div
                  className="w-full rounded-full h-2"
                  style={{ background: "var(--background-secondary)" }}
                >
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        codingProgress.total > 0
                          ? (codingProgress.submitted /
                              codingProgress.total) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {contest.sections.coding.hasTimer && contest.sections.coding.duration > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22C55E" }}>
                      <Clock className="w-3 h-3" />
                      {contest.sections.coding.duration} min
                    </span>
                  )}
                </div>
                <span className="text-green-500 group-hover:translate-x-2 transition-transform">
                  Continue →
                </span>
              </div>
            </button>
          )}

          {/* Forms Section */}
          {contest?.sections?.forms?.enabled && (
            <button
              onClick={() =>
                router.push(`/contest/${contestId}/forms`)
              }
              className="rounded-2xl p-6 text-left transition-all duration-300 hover:translate-y-[-2px] group"
              style={{
                background: "var(--background-card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "rgba(6, 182, 212, 0.2)" }}
                >
                  <ClipboardList className="w-8 h-8 text-cyan-500" />
                </div>
                <div>
                  <h3
                    className="text-xl font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    Forms Section
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    Custom Assessment Forms
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground-secondary)" }}
                >
                  Fill out assessment forms for this contest
                </p>
              </div>

              <div className="flex justify-between items-center">
                <span
                  style={{ color: "var(--foreground-secondary)" }}
                >
                  Forms
                </span>
                <span className="text-cyan-500 group-hover:translate-x-2 transition-transform">
                  Continue →
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Final Submit Button */}
        <div className="text-center">
          <button
            onClick={handleFinalSubmit}
            disabled={submitting}
            className="text-xl px-12 py-4 rounded-xl flex items-center gap-3 mx-auto text-white font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), #FF8C5A)",
            }}
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                Final Submit
              </>
            )}
          </button>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            This will submit all your answers. You cannot make changes
            after submission.
          </p>
        </div>
      </div>
    </div>
  );
}
