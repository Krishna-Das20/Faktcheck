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
  ArrowLeft,
  CheckCircle,
  ClipboardList,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ContestHubPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const {
    isStarted,
    progress,
    contest,
    loading,
    sectionStatuses,
  } = useContestTimer();

  const [mcqProgress, setMcqProgress] = useState({ answered: 0, total: 0 });
  const [codingProgress, setCodingProgress] = useState({
    submitted: 0,
    total: 0,
  });

  // Fetch section progress on mount
  useEffect(() => {
    const fetchSectionProgress = async () => {
      try {
        // MCQ progress from localStorage (only if section not submitted)
        if (sectionStatuses.mcq !== "SUBMITTED") {
          const mcqAnswers = JSON.parse(
            localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
          );
          const mcqRes = await fetch(`/api/mcqs/contest/${contestId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const mcqData = await mcqRes.json();
          setMcqProgress({
            answered: Object.keys(mcqAnswers).length,
            total: mcqData.mcqs?.length || 0,
          });
        }

        // Coding progress
        if (sectionStatuses.coding !== "SUBMITTED") {
          const codingRes = await fetch(
            `/api/coding/contest/${contestId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const codingData = await codingRes.json();
          const problems = codingData.problems || [];

          let solvedCount = 0;
          for (const prob of problems) {
            try {
              const subRes = await fetch(
                `/api/submissions/problem/${prob._id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              const subData = await subRes.json();
              if (subData.submissions?.length > 0) solvedCount++;
            } catch { /* skip */ }
          }

          setCodingProgress({
            submitted: solvedCount,
            total: problems.length,
          });
        }
      } catch {
        console.error("Error fetching progress");
      }
    };

    if (contestId && isStarted && token) {
      fetchSectionProgress();
    }
  }, [contestId, isStarted, token, sectionStatuses]);

  const handleLeaveContest = () => {
    const confirmed = window.confirm(
      "Are you sure you want to leave the contest?\n\nYour submitted sections are saved. Unsubmitted sections will NOT be submitted."
    );
    if (confirmed) {
      router.push(`/contests/${contestId}`);
    }
  };

  // Check if all enabled sections are submitted
  const allSectionsSubmitted = (() => {
    if (!contest?.sections) return false;
    if (contest.sections.mcq?.enabled && sectionStatuses.mcq !== "SUBMITTED") return false;
    if (contest.sections.coding?.enabled && sectionStatuses.coding !== "SUBMITTED") return false;
    if (contest.sections.forms?.enabled && sectionStatuses.forms !== "SUBMITTED") return false;
    return true;
  })();

  // Loading state
  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
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
      <div className="page-shell flex items-center justify-center">
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
      <div className="page-shell flex items-center justify-center">
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

  // Already submitted (all sections)
  if (
    progress?.status === "SUBMITTED" ||
    progress?.status === "TIMED_OUT" ||
    allSectionsSubmitted
  ) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div
          className="text-center rounded-2xl p-8 max-w-md"
          style={{
            background: "var(--background-card)",
            border: "1px solid var(--border)",
          }}
        >
          <CheckCircle
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: "#22C55E" }}
          />
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            Contest Complete!
          </h2>
          <p className="mb-6" style={{ color: "var(--foreground-secondary)" }}>
            All sections have been submitted. Thank you for participating!
          </p>
          <div className="space-y-3">
            <Link
              href={`/contest/${contestId}/review`}
              className="block w-full py-3 rounded-xl text-center font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), #FF8C5A)",
              }}
            >
              View Your Results
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

  // Helper to render section card
  const renderSectionCard = (
    sectionKey: string,
    label: string,
    description: string,
    icon: React.ReactNode,
    accentColor: string,
    accentBg: string,
    progressInfo?: { value: number; total: number; label: string },
  ) => {
    const sectionConfig = contest?.sections?.[sectionKey];
    if (!sectionConfig?.enabled) return null;

    const status = sectionStatuses[sectionKey] || "NOT_STARTED";
    const isSubmitted = status === "SUBMITTED";
    const hasTimer = sectionConfig.hasTimer && sectionConfig.duration > 0;

    return (
      <button
        key={sectionKey}
        onClick={() => {
          if (isSubmitted) {
            toast.error(`${label} already submitted. Cannot re-enter.`);
            return;
          }
          router.push(`/contest/${contestId}/${sectionKey}`);
        }}
        disabled={isSubmitted}
        className={`rounded-2xl p-6 text-left transition-all duration-300 group ${
          isSubmitted
            ? "opacity-60 cursor-not-allowed"
            : "hover:translate-y-[-2px]"
        }`}
        style={{
          background: "var(--background-card)",
          border: `1px solid ${isSubmitted ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-3 rounded-lg"
            style={{ background: accentBg }}
          >
            {icon}
          </div>
          <div className="flex-1">
            <h3
              className="text-xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {label}
            </h3>
            <p
              className="text-sm"
              style={{ color: "var(--foreground-secondary)" }}
            >
              {description}
            </p>
          </div>
          {/* Status badge */}
          {isSubmitted && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-500">
              <CheckCircle className="w-3.5 h-3.5" />
              Submitted
            </div>
          )}
          {status === "IN_PROGRESS" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: `${accentBg}`, color: accentColor }}>
              <Clock className="w-3.5 h-3.5" />
              In Progress
            </div>
          )}
        </div>

        {/* Progress bar (only if not submitted and we have progress data) */}
        {progressInfo && !isSubmitted && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: "var(--foreground-secondary)" }}>
                Progress
              </span>
              <span style={{ color: accentColor }}>
                {progressInfo.value} {progressInfo.label}
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
                    progressInfo.total > 0
                      ? (progressInfo.value / progressInfo.total) * 100
                      : 0
                  }%`,
                  background: accentColor,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {sectionConfig.totalMarks > 0 && (
              <span
                className="px-2 py-1 rounded-md text-xs font-medium"
                style={{ background: accentBg, color: accentColor }}
              >
                {sectionConfig.totalMarks} points
              </span>
            )}
            {hasTimer && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                style={{ background: accentBg, color: accentColor }}
              >
                <Clock className="w-3 h-3" />
                {sectionConfig.duration} min
              </span>
            )}
          </div>
          {isSubmitted ? (
            <Lock className="w-4 h-4" style={{ color: "var(--foreground-muted)" }} />
          ) : (
            <span
              className="group-hover:translate-x-2 transition-transform"
              style={{ color: accentColor }}
            >
              {status === "IN_PROGRESS" ? "Continue →" : "Start →"}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, var(--background) 0%, var(--background-card) 50%, var(--background) 100%)" }}>
      {/* Header */}
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
            {/* Section completion counter */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground-secondary)",
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {Object.values(sectionStatuses).filter((s) => s === "SUBMITTED").length}
              /{
                [
                  contest?.sections?.mcq?.enabled,
                  contest?.sections?.coding?.enabled,
                  contest?.sections?.forms?.enabled,
                ].filter(Boolean).length
              } sections done
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
            Choose a section to attempt. Once submitted, a section cannot be re-entered.
          </p>
        </div>

        {/* Section Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {renderSectionCard(
            "mcq",
            "MCQ Section",
            "Multiple Choice Questions",
            <FileText className="w-8 h-8" style={{ color: "var(--primary)" }} />,
            "var(--primary)",
            "rgba(255,107,53,0.2)",
            sectionStatuses.mcq !== "SUBMITTED"
              ? { value: mcqProgress.answered, total: mcqProgress.total, label: "answered" }
              : undefined
          )}

          {renderSectionCard(
            "coding",
            "Coding Section",
            "Programming Problems",
            <Code className="w-8 h-8 text-green-500" />,
            "#22C55E",
            "rgba(34, 197, 94, 0.2)",
            sectionStatuses.coding !== "SUBMITTED"
              ? { value: codingProgress.submitted, total: codingProgress.total, label: "submitted" }
              : undefined
          )}

          {renderSectionCard(
            "forms",
            "Forms Section",
            "Custom Assessment Forms",
            <ClipboardList className="w-8 h-8 text-cyan-500" />,
            "#06B6D4",
            "rgba(6, 182, 212, 0.2)"
          )}
        </div>
      </div>
    </div>
  );
}
