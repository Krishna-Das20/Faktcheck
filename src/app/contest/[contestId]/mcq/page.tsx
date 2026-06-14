"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useContestTimer } from "@/context/ContestTimerContext";
import toast from "react-hot-toast";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";

interface MCQOption {
  text: string;
  imageUrl?: string | null;
}

interface MCQQuestion {
  _id: string;
  question: string;
  options: MCQOption[];
  questionType: "SINGLE" | "MULTIPLE";
  marks: number;
  negativeMarks: number;
  difficulty?: string;
  category?: string;
  imageUrl?: string;
  order?: number;
}

export default function MCQSectionPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const {
    activeSectionTimer,
    activeSectionFormatted,
    progress,
    sectionStatuses,
    startSection,
    submitSection,
  } = useContestTimer();

  const [mcqs, setMcqs] = useState<MCQQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [contestInfo, setContestInfo] = useState<any>(null);
  const [sectionStarted, setSectionStarted] = useState(false);

  // Time tracking refs
  const questionStartTime = useRef(Date.now());
  const sectionStartTime = useRef(Date.now());

  // Block re-entry if section already submitted
  useEffect(() => {
    if (sectionStatuses.mcq === "SUBMITTED") {
      toast.error("MCQ section already submitted. Cannot re-enter.");
      router.replace(`/contest/${contestId}/hub`);
      return;
    }
    if (progress) {
      if (
        progress.status === "SUBMITTED" ||
        progress.status === "TIMED_OUT"
      ) {
        toast.error("Contest already submitted. You cannot re-enter.");
        router.replace(`/contest/${contestId}/review`);
      }
      if (progress.terminationReason === "MALPRACTICE") {
        toast.error("Contest terminated due to malpractice.");
        router.replace(`/contest/${contestId}/review`);
      }
    }
  }, [progress, sectionStatuses, contestId, router]);

  // Start section timer on mount
  useEffect(() => {
    if (sectionStatuses.mcq !== "SUBMITTED" && !sectionStarted) {
      startSection("mcq")
        .then(() => setSectionStarted(true))
        .catch(() => {
          router.replace(`/contest/${contestId}/hub`);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch MCQs
  useEffect(() => {
    const fetchMCQs = async () => {
      try {
        const res = await fetch(`/api/mcqs/contest/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setMcqs(data.mcqs || []);
          setContestInfo(data.contest);
        } else {
          toast.error(data.message || "Failed to load questions");
        }
      } catch {
        toast.error("Failed to load questions");
      }
      setLoading(false);
    };

    fetchMCQs();

    // Load saved answers from localStorage
    const savedAnswers = localStorage.getItem(
      `mcq_answers_${contestId}`
    );
    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch {
        // Corrupted data — ignore
      }
    }
  }, [contestId, token]);

  // Persist answers to localStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(
        `mcq_answers_${contestId}`,
        JSON.stringify(answers)
      );
    }
  }, [answers, contestId]);

  // Periodic auto-save to backend (every 30s)
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      if (Object.keys(answers).length > 0) {
        try {
          const formattedAnswers = Object.keys(answers).map(
            (mcqId) => ({
              mcqId,
              selectedOptions: answers[mcqId],
            })
          );

          await fetch(`/api/contests/${contestId}/save-progress`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ mcqAnswers: formattedAnswers }),
          });
        } catch {
          console.error("Auto-save failed");
        }
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [answers, contestId, token]);

  // Emergency save via sendBeacon on browser close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (Object.keys(answers).length > 0) {
        const formattedAnswers = Object.keys(answers).map(
          (mcqId) => ({
            mcqId,
            selectedOptions: answers[mcqId],
          })
        );
        const storedToken = localStorage.getItem("token");
        const data = JSON.stringify({
          mcqAnswers: formattedAnswers,
          token: storedToken,
        });
        navigator.sendBeacon(
          `/api/contests/${contestId}/emergency-save`,
          new Blob([data], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [answers, contestId]);

  // Handle question navigation with time tracking
  const handleQuestionChange = (newQuestion: number) => {
    if (mcqs.length === 0) return;
    questionStartTime.current = Date.now();
    setCurrentQuestion(newQuestion);
  };

  // Select/deselect option
  const handleOptionSelect = (mcqId: string, optionIndex: number) => {
    const mcq = mcqs.find((m) => m._id === mcqId);
    if (!mcq || !mcq.options) return;

    const isMultipleAnswer = mcq.questionType === "MULTIPLE";

    if (isMultipleAnswer) {
      setAnswers((prev) => {
        const current = prev[mcqId] || [];
        if (current.includes(optionIndex)) {
          return {
            ...prev,
            [mcqId]: current.filter((i) => i !== optionIndex),
          };
        }
        return { ...prev, [mcqId]: [...current, optionIndex] };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [mcqId]: [optionIndex] }));
    }
  };

  // Clear current answer
  const resetCurrentAnswer = () => {
    const mcqId = mcqs[currentQuestion]._id;
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[mcqId];
      localStorage.setItem(
        `mcq_answers_${contestId}`,
        JSON.stringify(newAnswers)
      );
      return newAnswers;
    });
    toast.success("Answer cleared");
  };

  // Submit section and go back to hub
  const handleSubmitAndBackToHub = async () => {
    const confirmed = window.confirm(
      "Submitting will lock this section. You cannot re-enter. Continue?"
    );
    if (!confirmed) return;
    await handleSubmit();
  };

  // Submit MCQ section via section submit API
  const handleSubmit = async () => {
    if (submitting) return;

    const unanswered = mcqs.filter(
      (mcq) =>
        !answers[mcq._id] || answers[mcq._id].length === 0
    );

    if (unanswered.length > 0 && (activeSectionTimer ?? 0) > 0) {
      const confirm = window.confirm(
        `You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirm) return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.keys(answers).map(
        (mcqId) => ({
          mcqId,
          selectedOptions: answers[mcqId],
        })
      );

      await submitSection("mcq", { mcqAnswers: formattedAnswers });
      router.push(`/contest/${contestId}/hub`);
    } catch {
      toast.error("Failed to submit answers");
      setSubmitting(false);
    }
  };

  // Toggle flag
  const toggleFlag = (index: number) => {
    setFlagged((prev) => {
      const newFlagged = new Set(prev);
      if (newFlagged.has(index)) {
        newFlagged.delete(index);
      } else {
        newFlagged.add(index);
      }
      return newFlagged;
    });
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

  // No questions
  if (mcqs.length === 0) {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            No Questions Available
          </h2>
          <button
            onClick={() =>
              router.push(`/contest/${contestId}/hub`)
            }
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), #FF8C5A)",
            }}
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  const currentMCQ = mcqs[currentQuestion];
  if (!currentMCQ || !currentMCQ.options) {
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

  const isMultipleAnswer = currentMCQ.questionType === "MULTIPLE";
  const selectedOptions = answers[currentMCQ._id] || [];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, var(--background) 0%, var(--background-card) 50%, var(--background) 100%)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          background: "var(--background-card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={handleSubmitAndBackToHub}
                className="flex items-center gap-1 sm:gap-2 flex-shrink-0 transition-colors"
                style={{ color: "var(--foreground-secondary)" }}
                aria-label="Submit and go back to hub"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">
                  Submit &amp; Back to Hub
                </span>
              </button>
              <div className="min-w-0">
                <h1
                  className="text-base sm:text-xl font-bold truncate"
                  style={{ color: "var(--foreground)" }}
                >
                  {contestInfo?.title || "MCQ Section"}
                </h1>
                <p
                  className="text-xs sm:text-sm"
                  style={{ color: "var(--foreground-secondary)" }}
                >
                  Question {currentQuestion + 1} of {mcqs.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {activeSectionTimer !== null && (
                <div
                  className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-sm sm:text-lg font-bold ${
                    (activeSectionTimer ?? 0) < 300 ? "animate-pulse" : ""
                  }`}
                  style={{
                    background:
                      (activeSectionTimer ?? 0) < 300
                        ? "rgba(239, 68, 68, 0.2)"
                        : "var(--background-secondary)",
                    color:
                      (activeSectionTimer ?? 0) < 300
                        ? "#ef4444"
                        : "var(--foreground)",
                  }}
                  role="timer"
                  aria-live="polite"
                >
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{activeSectionFormatted}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), #FF8C5A)",
                }}
              >
                {submitting ? "Submitting..." : "Submit MCQs"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Panel */}
          <div className="lg:col-span-3">
            <div
              className="rounded-2xl p-6"
              style={{
                background: "var(--background-card)",
                border: "1px solid var(--border)",
              }}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-lg text-lg font-bold"
                    style={{
                      background: "rgba(255,107,53,0.15)",
                      color: "var(--primary)",
                    }}
                  >
                    Q{currentQuestion + 1}
                  </span>
                  {currentMCQ.difficulty && (
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-semibold uppercase"
                      style={{
                        background: "var(--background-secondary)",
                        color: "var(--foreground-secondary)",
                      }}
                    >
                      {currentMCQ.difficulty}
                    </span>
                  )}
                  {currentMCQ.category && (
                    <span
                      className="px-3 py-1 rounded-lg text-xs font-semibold"
                      style={{
                        background: "rgba(59,130,246,0.15)",
                        color: "#3B82F6",
                      }}
                    >
                      {currentMCQ.category}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => toggleFlag(currentQuestion)}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    background: flagged.has(currentQuestion)
                      ? "rgba(234,179,8,0.2)"
                      : "var(--background-secondary)",
                    color: flagged.has(currentQuestion)
                      ? "#EAB308"
                      : "var(--foreground-secondary)",
                  }}
                  aria-label={
                    flagged.has(currentQuestion)
                      ? "Unflag question"
                      : "Flag question for review"
                  }
                >
                  <Flag
                    className="w-5 h-5"
                    fill={
                      flagged.has(currentQuestion)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>

              {/* Question Text */}
              <div
                className="mb-6 select-none"
                onCopy={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              >
                <p
                  className="text-lg leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--foreground)" }}
                >
                  {currentMCQ.question}
                </p>

                {currentMCQ.imageUrl && (
                  <div className="mt-4">
                    <img
                      src={currentMCQ.imageUrl}
                      alt="Question"
                      className="max-w-full max-h-80 rounded-lg"
                      style={{ border: "1px solid var(--border)" }}
                      onContextMenu={(e) => e.preventDefault()}
                      draggable="false"
                    />
                  </div>
                )}

                {isMultipleAnswer && (
                  <p
                    className="text-sm mt-2"
                    style={{ color: "var(--primary)" }}
                  >
                    (Multiple answers possible — select all that
                    apply)
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3" role="radiogroup" aria-label="Answer options">
                {currentMCQ.options.map(
                  (option: MCQOption, index: number) => {
                    const isSelected =
                      selectedOptions.includes(index);
                    const optionLabel = String.fromCharCode(
                      65 + index
                    );

                    return (
                      <button
                        key={index}
                        onClick={() =>
                          handleOptionSelect(
                            currentMCQ._id,
                            index
                          )
                        }
                        className="w-full text-left p-4 rounded-lg transition-all"
                        style={{
                          border: isSelected
                            ? "2px solid var(--primary)"
                            : "2px solid var(--border)",
                          background: isSelected
                            ? "rgba(255,107,53,0.1)"
                            : "var(--background-secondary)",
                        }}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Option ${optionLabel}: ${option.text}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              borderColor: isSelected
                                ? "var(--primary)"
                                : "var(--foreground-muted)",
                              background: isSelected
                                ? "var(--primary)"
                                : "transparent",
                            }}
                          >
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span
                              className="font-semibold mr-2"
                              style={{
                                color: "var(--primary)",
                              }}
                            >
                              {optionLabel}.
                            </span>
                            <span
                              style={{
                                color: "var(--foreground)",
                              }}
                            >
                              {option.text}
                            </span>
                            {option.imageUrl && (
                              <div className="mt-2">
                                <img
                                  src={option.imageUrl}
                                  alt={`Option ${optionLabel}`}
                                  className="max-w-full max-h-40 rounded-lg object-contain"
                                  style={{ border: "1px solid var(--border)" }}
                                  onContextMenu={(e) => e.preventDefault()}
                                  draggable="false"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Marks Info + Reset */}
              <div
                className="mt-6 p-4 rounded-lg flex items-center justify-between text-sm"
                style={{
                  background: "var(--background-secondary)",
                }}
              >
                <div className="flex items-center gap-6">
                  <span
                    style={{
                      color: "var(--foreground-secondary)",
                    }}
                  >
                    Marks:{" "}
                    <span className="text-green-400 font-semibold">
                      +{currentMCQ.marks}
                    </span>
                  </span>
                  {currentMCQ.negativeMarks > 0 && (
                    <span
                      style={{
                        color: "var(--foreground-secondary)",
                      }}
                    >
                      Negative:{" "}
                      <span className="text-red-400 font-semibold">
                        -{currentMCQ.negativeMarks}
                      </span>
                    </span>
                  )}
                </div>

                <button
                  onClick={resetCurrentAnswer}
                  disabled={selectedOptions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--background-card)",
                    color: "var(--foreground)",
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Answer</span>
                </button>
              </div>

              {/* Navigation */}
              <div
                className="flex items-center justify-between mt-6 pt-6"
                style={{
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={() =>
                    handleQuestionChange(
                      Math.max(0, currentQuestion - 1)
                    )
                  }
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--background-secondary)",
                    color: "var(--foreground-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                  Previous
                </button>

                <button
                  onClick={() =>
                    handleQuestionChange(
                      Math.min(
                        mcqs.length - 1,
                        currentQuestion + 1
                      )
                    )
                  }
                  disabled={
                    currentQuestion === mcqs.length - 1
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--background-secondary)",
                    color: "var(--foreground-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Question Palette */}
          <div className="lg:col-span-1">
            <div
              className="rounded-2xl p-6 sticky top-24"
              style={{
                background: "var(--background-card)",
                border: "1px solid var(--border)",
              }}
            >
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: "var(--foreground)" }}
              >
                Question Palette
              </h3>

              <div
                className="grid grid-cols-5 gap-2 mb-6"
                role="navigation"
                aria-label="Question navigation"
              >
                {mcqs.map((mcq, index) => {
                  const isAnswered =
                    answers[mcq._id] &&
                    answers[mcq._id].length > 0;
                  const isFlagged = flagged.has(index);
                  const isCurrent =
                    index === currentQuestion;

                  return (
                    <button
                      key={mcq._id}
                      onClick={() =>
                        handleQuestionChange(index)
                      }
                      className={`aspect-square rounded-lg text-sm font-semibold transition-all relative ${
                        isCurrent ? "scale-110" : ""
                      }`}
                      style={{
                        background: isCurrent
                          ? "var(--primary)"
                          : isAnswered
                            ? "rgba(34,197,94,0.2)"
                            : "var(--background-secondary)",
                        color: isCurrent
                          ? "white"
                          : isAnswered
                            ? "#22C55E"
                            : "var(--foreground-secondary)",
                        border: isAnswered
                          ? "1px solid rgba(34,197,94,0.5)"
                          : "1px solid transparent",
                      }}
                      aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ""}${isFlagged ? ", flagged" : ""}`}
                      aria-current={
                        isCurrent ? "true" : undefined
                      }
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag
                          className="w-3 h-3 absolute top-0.5 right-0.5 text-yellow-500"
                          fill="currentColor"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded"
                    style={{
                      background: "rgba(34,197,94,0.2)",
                      border: "1px solid rgba(34,197,94,0.5)",
                    }}
                  />
                  <span
                    style={{
                      color: "var(--foreground-secondary)",
                    }}
                  >
                    Answered ({Object.keys(answers).length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded"
                    style={{
                      background: "var(--background-secondary)",
                    }}
                  />
                  <span
                    style={{
                      color: "var(--foreground-secondary)",
                    }}
                  >
                    Not Answered (
                    {mcqs.length -
                      Object.keys(answers).length}
                    )
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded relative"
                    style={{
                      background: "var(--background-secondary)",
                    }}
                  >
                    <Flag
                      className="w-3 h-3 absolute top-0.5 right-0.5 text-yellow-500"
                      fill="currentColor"
                    />
                  </div>
                  <span
                    style={{
                      color: "var(--foreground-secondary)",
                    }}
                  >
                    Flagged ({flagged.size})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
