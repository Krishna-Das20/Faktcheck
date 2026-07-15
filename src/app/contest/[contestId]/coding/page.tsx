"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useContestTimer } from "@/context/ContestTimerContext";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import {
  Play,
  Send,
  Clock,
  Code,
  CheckCircle,
  XCircle,
  Loader,
  Terminal,
  FileCode,
  CheckSquare,
  ArrowLeft,
  Minimize2,
  Maximize2,
  GripVertical,
  GripHorizontal,
} from "lucide-react";
import { LANGUAGES, DEFAULT_CODE, DIFFICULTY_COLORS } from "@/lib/constants";

// Dynamic import Monaco — no SSR, with loading placeholder
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-dark-800 animate-pulse rounded-lg flex items-center justify-center">
      <span className="text-gray-400 text-sm">Loading editor...</span>
    </div>
  ),
});

interface LanguageOption {
  id: number;
  name: string;
  value: string;
  monaco: string;
  template: string;
}

// Map LANGUAGES to component format
const LANGUAGE_OPTIONS: LanguageOption[] = LANGUAGES.map((lang) => ({
  id: lang.id,
  name: lang.label,
  value: lang.value,
  monaco: lang.monaco,
  template: DEFAULT_CODE[lang.value] || "// Your code here\n",
}));

export default function CodingSectionPage() {
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

  // Block re-entry if section already submitted
  useEffect(() => {
    if (sectionStatuses.coding === "SUBMITTED") {
      toast.error("Coding section already submitted. Cannot re-enter.");
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
    if (sectionStatuses.coding !== "SUBMITTED") {
      startSection("coding").catch(() => {
        router.replace(`/contest/${contestId}/hub`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [problems, setProblems] = useState<any[]>([]);
  const [currentProblem, setCurrentProblem] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(
    LANGUAGE_OPTIONS[3]
  ); // Python default
  const [code, setCode] = useState(LANGUAGE_OPTIONS[3].template);
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">(
    "description"
  );
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any>(null);
  const [contestInfo, setContestInfo] = useState<any>(null);
  const [isIoMinimized, setIsIoMinimized] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"description" | "editor">("editor");

  // Resizable panel states
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [ioHeight, setIoHeight] = useState(250); // pixels
  const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Time tracking
  const problemStartTime = useRef(Date.now());
  const sectionStartTime = useRef(Date.now());

  // Fetch problems on mount
  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const res = await fetch(`/api/coding/contest/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setProblems(data.problems || []);
          if (data.contest) setContestInfo(data.contest);
        } else {
          toast.error(data.message || "Failed to load problems");
        }
      } catch {
        toast.error("Failed to load problems");
      }
      setLoading(false);
    };
    fetchProblems();
  }, [contestId, token]);

  // Fetch submissions when problem changes
  useEffect(() => {
    if (problems.length > 0) {
      fetchSubmissions(problems[currentProblem]._id);
    }
  }, [currentProblem, problems]);

  // Save/restore code per problem from localStorage
  useEffect(() => {
    if (problems.length > 0 && problems[currentProblem]) {
      const problemId = problems[currentProblem]._id;

      // Restore language
      const langKey = `lang_${contestId}_${problemId}`;
      const savedLangId = localStorage.getItem(langKey);
      let restoredLang = LANGUAGE_OPTIONS[3];
      if (savedLangId) {
        const found = LANGUAGE_OPTIONS.find(
          (l) => l.id === parseInt(savedLangId)
        );
        if (found) restoredLang = found;
      }
      setSelectedLanguage(restoredLang);

      // Restore code
      const codeKey = `code_${contestId}_${problemId}`;
      const savedCode = localStorage.getItem(codeKey);
      setCode(savedCode ?? restoredLang.template);

      // Restore I/O
      setCustomInput(
        localStorage.getItem(`input_${contestId}_${problemId}`) || ""
      );
      setOutput(
        localStorage.getItem(`output_${contestId}_${problemId}`) || ""
      );
      setTestResults(null);
    }
  }, [currentProblem, problems, contestId]);

  // Persist code/input/output on every change
  useEffect(() => {
    if (problems.length > 0 && problems[currentProblem]) {
      const pid = problems[currentProblem]._id;
      localStorage.setItem(`code_${contestId}_${pid}`, code);
      localStorage.setItem(`input_${contestId}_${pid}`, customInput);
      localStorage.setItem(`output_${contestId}_${pid}`, output);
    }
  }, [code, customInput, output, currentProblem, problems, contestId]);

  // Persist language
  useEffect(() => {
    if (problems.length > 0 && problems[currentProblem]) {
      const pid = problems[currentProblem]._id;
      localStorage.setItem(
        `lang_${contestId}_${pid}`,
        selectedLanguage.id.toString()
      );
    }
  }, [selectedLanguage, currentProblem, problems, contestId]);

  // Track time when changing problems
  const trackProblemTime = async (problemId: string, timeSpent: number) => {
    try {
      await fetch(`/api/contests/${contestId}/track-time`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "coding", problemId, timeSpent }),
      });
    } catch (error) {
      console.error("Error tracking time:", error);
    }
  };

  // Handle problem navigation with time tracking
  const handleProblemChange = (newProblem: number) => {
    if (problems.length === 0) return;
    const currentProb = problems[currentProblem];
    const timeSpent = Math.floor((Date.now() - problemStartTime.current) / 1000);
    if (currentProb && timeSpent > 0) {
      trackProblemTime(currentProb._id, timeSpent);
    }
    problemStartTime.current = Date.now();
    setCurrentProblem(newProblem);
  };

  // Track section time when leaving coding section
  useEffect(() => {
    return () => {
      const sectionTimeSpent = Math.floor((Date.now() - sectionStartTime.current) / 1000);
      const storedToken = localStorage.getItem("token");
      fetch(`/api/contests/${contestId}/track-time`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedToken}`,
        },
        body: JSON.stringify({ type: "coding-section", timeSpent: sectionTimeSpent }),
      }).catch((err) => console.error("Error tracking section time:", err));
    };
  }, [contestId]);

  // Horizontal resize handlers
  const handleHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHorizontal(true);
  }, []);

  const handleVerticalMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingVertical(true);
  }, []);

  // Mouse move/up for resizing with rAF
  useEffect(() => {
    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (isResizingHorizontal && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
          setLeftPanelWidth(Math.min(Math.max(15, newWidth), 85));
        }
        if (isResizingVertical && rightPanelRef.current) {
          const rect = rightPanelRef.current.getBoundingClientRect();
          const newHeight = rect.bottom - e.clientY;
          const maxHeight = rect.height * 0.6;
          setIoHeight(Math.min(Math.max(80, newHeight), maxHeight));
        }
      });
    };

    const handleMouseUp = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      setIsResizingHorizontal(false);
      setIsResizingVertical(false);
    };

    if (isResizingHorizontal || isResizingVertical) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = isResizingHorizontal ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingHorizontal, isResizingVertical]);

  // Emergency save coding drafts via sendBeacon on browser close
  // Mirrors the MCQ page's emergency-save pattern for data preservation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (problems.length === 0) return;

      // Collect all code drafts from localStorage
      const codingDrafts = problems
        .map((p) => {
          const savedCode = localStorage.getItem(`code_${contestId}_${p._id}`);
          const savedLang = localStorage.getItem(`lang_${contestId}_${p._id}`);
          if (savedCode && savedCode.trim()) {
            return {
              problemId: p._id,
              code: savedCode,
              languageId: savedLang ? parseInt(savedLang) : selectedLanguage.id,
            };
          }
          return null;
        })
        .filter(Boolean);

      if (codingDrafts.length > 0) {
        const storedToken = localStorage.getItem("token");
        const data = JSON.stringify({
          codingDrafts,
          token: storedToken,
        });
        navigator.sendBeacon(
          `/api/contests/${contestId}/emergency-save`,
          new Blob([data], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [problems, contestId, selectedLanguage.id]);

  const fetchSubmissions = async (problemId: string) => {
    try {
      const res = await fetch(
        `/api/submissions/problem/${problemId}?contestId=${contestId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) setSubmissions(data.submissions || []);
    } catch {
      console.error("Error fetching submissions");
    }
  };

  const handleLanguageChange = (lang: LanguageOption) => {
    const isTemplateOrEmpty =
      !code.trim() ||
      code.trim() === selectedLanguage.template.trim();
    setSelectedLanguage(lang);
    if (isTemplateOrEmpty) setCode(lang.template);
    setOutput("");
    setTestResults(null);
  };

  const handleRunCode = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first");
      return;
    }

    setRunning(true);
    setOutput("Running...");
    setTestResults(null);

    try {
      const problem = problems[currentProblem];
      const res = await fetch("/api/submissions/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problemId: problem._id,
          sourceCode: code,
          languageId: selectedLanguage.id,
          input: customInput || problem.examples?.[0]?.input || "",
        }),
      });
      const data = await res.json();

      if (data.error) {
        setOutput(data.error);
        toast.error("Compilation/Runtime error");
      } else if (data.passed === true) {
        setOutput(
          `✅ TEST PASSED\n\nYour Output:\n${data.output}\n\nExpected:\n${data.expectedOutput}`
        );
        toast.success("Test case passed!");
      } else if (data.passed === false) {
        setOutput(
          `❌ TEST FAILED\n\nYour Output:\n${data.output}\n\nExpected:\n${data.expectedOutput}`
        );
        toast.error("Test case failed");
      } else {
        setOutput(data.output || "No output");
        toast.success("Code executed successfully");
      }
    } catch {
      setOutput("Failed to run code");
      toast.error("Failed to run code");
    } finally {
      setRunning(false);
    }
  };

  const handleCheckAll = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first");
      return;
    }

    setChecking(true);
    setOutput("Checking all test cases...");
    setTestResults(null);

    try {
      const problem = problems[currentProblem];
      const res = await fetch("/api/submissions/check-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          problemId: problem._id,
          sourceCode: code,
          languageId: selectedLanguage.id,
        }),
      });
      const data = await res.json();

      let display = data.allPassed
        ? `✅ ALL PASSED (${data.passedCount}/${data.totalTestcases})\n\n`
        : `❌ FAILED (${data.passedCount}/${data.totalTestcases})\n\n`;

      data.testcaseResults?.forEach((tc: any) => {
        display += `TC ${tc.testcaseNumber}: ${tc.passed ? "✅" : "❌"}\n`;
        if (!tc.hidden) {
          display += `  Input: ${tc.input}\n  Expected: ${tc.expectedOutput}\n  Output: ${tc.actualOutput}\n`;
        } else {
          display += "  [Hidden]\n";
        }
        if (tc.error) display += `  Error: ${tc.error}\n`;
        display += `  Time: ${(tc.executionTime ?? 0).toFixed(2)}ms\n\n`;
      });

      setOutput(display);
      if (data.allPassed) {
        toast.success(`All ${data.totalTestcases} test cases passed!`);
      } else {
        toast.error(
          `${data.totalTestcases - data.passedCount} test case(s) failed`
        );
      }
    } catch {
      setOutput("Failed to check test cases");
      toast.error("Failed to check test cases");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("Please write some code first");
      return;
    }

    setSubmitting(true);
    setTestResults(null);

    try {
      const problem = problems[currentProblem];
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contestId,
          problemId: problem._id,
          sourceCode: code,
          languageId: selectedLanguage.id,
        }),
      });
      const data = await res.json();

      setTestResults(data.submission);

      if (data.saved) {
        toast.error("Code execution failed. Saved for manual review.");
        fetchSubmissions(problem._id);
        return;
      }

      if (data.submission?.verdict === "ACCEPTED") {
        toast.success(`Accepted! Score: ${data.submission.score}`);
      } else {
        toast.error(
          data.submission?.verdict?.replace(/_/g, " ") || "Submission failed"
        );
      }

      fetchSubmissions(problem._id);
    } catch {
      toast.error("Failed to submit code");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading
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

  // No problems
  if (problems.length === 0) {
    return (
      <div
        className="page-shell flex items-center justify-center"
       
      >
        <div className="text-center">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--foreground)" }}
          >
            No Coding Problems
          </h2>
          <button
            onClick={() => router.push(`/contest/${contestId}/hub`)}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--primary), #FF8C5A)",
            }}
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  const problem = problems[currentProblem];
  const isTimeLow = (activeSectionTimer ?? 0) < 300;

  const handleSubmitCodingSection = async () => {
    const confirmed = window.confirm(
      "Submitting will lock this section. You cannot re-enter. Continue?"
    );
    if (!confirmed) return;
    try {
      await submitSection("coding");
      router.push(`/contest/${contestId}/hub`);
    } catch {
      toast.error("Failed to submit coding section");
    }
  };

  return (
    <div
      className="h-screen flex flex-col"
     
    >
      {/* Header */}
      <div
        className="px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0"
        style={{
          background: "var(--background-card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Row 1: Back + Title + Timer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={handleSubmitCodingSection}
              className="flex items-center gap-1 flex-shrink-0 transition-colors"
              style={{ color: "var(--foreground-secondary)" }}
              aria-label="Submit and back to hub"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Submit & Hub</span>
            </button>
            <h1
              className="text-sm sm:text-lg font-bold truncate"
              style={{ color: "var(--foreground)" }}
            >
              {problem.title}
            </h1>
            {problem.difficulty && (
              <span
                className="hidden sm:inline px-2 py-0.5 rounded text-xs font-semibold"
                style={{
                  color:
                    DIFFICULTY_COLORS[problem.difficulty] ||
                    "var(--foreground-secondary)",
                  background: "var(--background-secondary)",
                }}
              >
                {problem.difficulty}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {activeSectionTimer !== null && (
              <div
                className={`flex items-center gap-1.5 px-2 sm:px-4 py-1 sm:py-2 rounded-lg font-mono text-sm sm:text-lg font-semibold ${
                  isTimeLow ? "animate-pulse" : ""
                }`}
                style={{
                  background: isTimeLow
                    ? "rgba(239,68,68,0.2)"
                    : "var(--background-secondary)",
                  color: isTimeLow ? "#ef4444" : "var(--foreground)",
                }}
                role="timer"
                aria-live="polite"
              >
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{activeSectionFormatted}</span>
              </div>
            )}
            <span
              className="text-sm hidden sm:block"
              style={{ color: "var(--foreground-secondary)" }}
            >
              Score:{" "}
              <span style={{ color: "var(--primary)" }} className="font-semibold">
                {problem.score}
              </span>
            </span>
          </div>
        </div>

        {/* Row 2: Language + Actions */}
        <div className="flex items-center justify-between gap-2 mt-2">
          <select
            value={selectedLanguage.id}
            onChange={(e) => {
              const found = LANGUAGE_OPTIONS.find(
                (l) => l.id === parseInt(e.target.value)
              );
              if (found) handleLanguageChange(found);
            }}
            className="rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
            style={{
              background: "var(--background-secondary)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
            aria-label="Select language"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleRunCode}
              disabled={running}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
              aria-label="Run code"
            >
              {running ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Run</span>
            </button>

            <button
              onClick={handleCheckAll}
              disabled={checking}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50"
              style={{
                background: "var(--background-secondary)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
              }}
              aria-label="Check all test cases"
            >
              {checking ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <CheckSquare className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Check All</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg flex items-center gap-1 text-white font-semibold transition-colors disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--primary), #FF8C5A)",
              }}
              aria-label="Submit code"
            >
              {submitting ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Submit</span>
            </button>
          </div>
        </div>

        {/* Problem Navigation */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 mt-2 overflow-x-auto"
          role="navigation"
          aria-label="Problem navigation"
        >
          {problems.map((p, index) => (
            <button
              key={p._id}
              onClick={() => handleProblemChange(index)}
              className="px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors flex-shrink-0"
              style={{
                background:
                  index === currentProblem
                    ? "var(--primary)"
                    : "var(--background-secondary)",
                color:
                  index === currentProblem
                    ? "white"
                    : "var(--foreground-secondary)",
              }}
              aria-current={index === currentProblem ? "true" : undefined}
            >
              P{index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Panel Toggle — visible only on small screens */}
      <div className="flex lg:hidden flex-shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--background-card)" }}>
        <button
          onClick={() => setMobilePanel("description")}
          className="flex-1 py-2.5 text-sm font-semibold text-center transition-colors"
          style={{
            color: mobilePanel === "description" ? "var(--primary)" : "var(--foreground-secondary)",
            borderBottom: mobilePanel === "description" ? "2px solid var(--primary)" : "2px solid transparent",
            background: mobilePanel === "description" ? "rgba(255,107,53,0.05)" : "transparent",
          }}
        >
          📄 Problem
        </button>
        <button
          onClick={() => setMobilePanel("editor")}
          className="flex-1 py-2.5 text-sm font-semibold text-center transition-colors"
          style={{
            color: mobilePanel === "editor" ? "var(--primary)" : "var(--foreground-secondary)",
            borderBottom: mobilePanel === "editor" ? "2px solid var(--primary)" : "2px solid transparent",
            background: mobilePanel === "editor" ? "rgba(255,107,53,0.05)" : "transparent",
          }}
        >
          💻 Editor
        </button>
      </div>

      {/* Main Content — Split Pane */}
      <div ref={containerRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel — Problem Description */}
        <div
          className={`flex flex-col overflow-hidden ${mobilePanel !== "description" ? "hidden lg:flex" : "flex"}`}
          style={{ width: `${leftPanelWidth}%`, borderRight: "1px solid var(--border)" }}
        >
          {/* Tabs */}
          <div
            className="flex"
            style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--background-card)",
            }}
          >
            <button
              onClick={() => setActiveTab("description")}
              className="px-6 py-3 text-sm font-medium transition-colors"
              style={{
                color:
                  activeTab === "description"
                    ? "var(--primary)"
                    : "var(--foreground-secondary)",
                borderBottom:
                  activeTab === "description"
                    ? "2px solid var(--primary)"
                    : "2px solid transparent",
              }}
            >
              <FileCode className="w-4 h-4 inline mr-2" />
              Description
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className="px-6 py-3 text-sm font-medium transition-colors"
              style={{
                color:
                  activeTab === "submissions"
                    ? "var(--primary)"
                    : "var(--foreground-secondary)",
                borderBottom:
                  activeTab === "submissions"
                    ? "2px solid var(--primary)"
                    : "2px solid transparent",
              }}
            >
              <Terminal className="w-4 h-4 inline mr-2" />
              Submissions ({submissions.length})
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 overflow-y-auto p-6 select-none"
            onCopy={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {activeTab === "description" ? (
              <div className="space-y-6">
                <div>
                  <h3
                    className="text-lg font-bold mb-3"
                    style={{ color: "var(--foreground)" }}
                  >
                    Description
                  </h3>
                  <p
                    className="leading-relaxed whitespace-pre-wrap"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    {problem.description}
                  </p>
                  {/* Problem Images (multi-image + backward compat) */}
                  {(() => {
                    const imgs = (problem as any).images?.length ? (problem as any).images : problem.imageUrl ? [{ url: problem.imageUrl }] : [];
                    return imgs.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {imgs.map((img: any, idx: number) => (
                          <img
                            key={idx}
                            src={img.url}
                            alt={`Problem image ${idx + 1}`}
                            className="max-w-full max-h-80 rounded-lg"
                            style={{ border: "1px solid var(--border)" }}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable="false"
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {problem.inputFormat && (
                  <div>
                    <h3
                      className="text-lg font-bold mb-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      Input Format
                    </h3>
                    <div
                      className="rounded-lg p-4"
                      style={{ background: "var(--background-secondary)" }}
                    >
                      <pre
                        className="text-sm font-mono whitespace-pre-wrap"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        {problem.inputFormat}
                      </pre>
                    </div>
                  </div>
                )}

                {problem.outputFormat && (
                  <div>
                    <h3
                      className="text-lg font-bold mb-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      Output Format
                    </h3>
                    <div
                      className="rounded-lg p-4"
                      style={{ background: "var(--background-secondary)" }}
                    >
                      <pre
                        className="text-sm font-mono whitespace-pre-wrap"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        {problem.outputFormat}
                      </pre>
                    </div>
                  </div>
                )}

                {problem.constraints?.length > 0 && (
                  <div>
                    <h3
                      className="text-lg font-bold mb-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      Constraints
                    </h3>
                    <div
                      className="rounded-lg p-4"
                      style={{ background: "var(--background-secondary)" }}
                    >
                      <ul className="list-disc list-inside space-y-1">
                        {problem.constraints.map(
                          (c: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm font-mono"
                              style={{
                                color: "var(--foreground-secondary)",
                              }}
                            >
                              {c}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {problem.examples?.length > 0 && (
                  <div>
                    <h3
                      className="text-lg font-bold mb-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      Examples
                    </h3>
                    <div className="space-y-4">
                      {problem.examples.map((ex: any, i: number) => (
                        <div
                          key={i}
                          className="rounded-lg p-4"
                          style={{
                            background: "var(--background-secondary)",
                          }}
                        >
                          <p
                            className="font-semibold mb-2"
                            style={{ color: "var(--primary)" }}
                          >
                            Example {i + 1}
                          </p>
                          <div className="space-y-2">
                            <div>
                              <p
                                className="text-sm mb-1"
                                style={{
                                  color: "var(--foreground-muted)",
                                }}
                              >
                                Input:
                              </p>
                              <pre
                                className="rounded p-2 text-sm font-mono"
                                style={{
                                  background: "var(--background)",
                                  color: "var(--foreground-secondary)",
                                }}
                              >
                                {ex.input}
                              </pre>
                            </div>
                            <div>
                              <p
                                className="text-sm mb-1"
                                style={{
                                  color: "var(--foreground-muted)",
                                }}
                              >
                                Output:
                              </p>
                              <pre
                                className="rounded p-2 text-sm font-mono"
                                style={{
                                  background: "var(--background)",
                                  color: "var(--foreground-secondary)",
                                }}
                              >
                                {ex.output}
                              </pre>
                            </div>
                            {ex.explanation && (
                              <div>
                                <p
                                  className="text-sm mb-1"
                                  style={{
                                    color: "var(--foreground-muted)",
                                  }}
                                >
                                  Explanation:
                                </p>
                                <p
                                  className="text-sm"
                                  style={{
                                    color: "var(--foreground-secondary)",
                                  }}
                                >
                                  {ex.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.length === 0 ? (
                  <p
                    className="text-center py-8"
                    style={{ color: "var(--foreground-secondary)" }}
                  >
                    No submissions yet
                  </p>
                ) : (
                  submissions.map((sub) => (
                    <div
                      key={sub._id}
                      className="rounded-lg p-4"
                      style={{
                        background: "var(--background-secondary)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="font-semibold"
                          style={{
                            color:
                              sub.verdict === "ACCEPTED"
                                ? "#22C55E"
                                : sub.verdict === "PENDING"
                                  ? "#EAB308"
                                  : "#EF4444",
                          }}
                        >
                          {sub.verdict === "ACCEPTED" && (
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                          )}
                          {sub.verdict !== "ACCEPTED" &&
                            sub.verdict !== "PENDING" && (
                              <XCircle className="w-4 h-4 inline mr-1" />
                            )}
                          {sub.verdict.replace(/_/g, " ")}
                        </span>
                        <span
                          className="text-sm"
                          style={{
                            color: "var(--foreground-secondary)",
                          }}
                        >
                          {new Date(sub.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-4 text-sm"
                        style={{
                          color: "var(--foreground-secondary)",
                        }}
                      >
                        <span>
                          Language:{" "}
                          <span style={{ color: "var(--foreground)" }}>
                            {LANGUAGE_OPTIONS.find(
                              (l) => l.id === sub.languageId
                            )?.name || sub.language}
                          </span>
                        </span>
                        <span>
                          Score:{" "}
                          <span style={{ color: "var(--primary)" }}>
                            {sub.score}
                          </span>
                        </span>
                        {sub.testcasesPassed !== undefined && (
                          <span>
                            Tests:{" "}
                            <span style={{ color: "var(--foreground)" }}>
                              {sub.testcasesPassed}/{sub.totalTestcases}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Resize Handle */}
        <div
          onMouseDown={handleHorizontalMouseDown}
          className="hidden lg:flex w-1.5 items-center justify-center cursor-col-resize group transition-colors flex-shrink-0"
          style={{ background: "var(--border)" }}
        >
          <GripVertical className="w-3 h-3 group-hover:opacity-100 opacity-40 transition-opacity" style={{ color: "var(--foreground-secondary)" }} />
        </div>

        {/* Right Panel — Code Editor */}
        <div
          ref={rightPanelRef}
          className={`flex-1 flex flex-col overflow-hidden ${mobilePanel !== "editor" ? "hidden lg:flex" : "flex"}`}>
          {/* Editor */}
          <div
            className="overflow-hidden"
            style={{
              flex: isIoMinimized ? "1 1 100%" : "1 1 auto",
              minHeight: "200px",
            }}
          >
            <Editor
              height="100%"
              language={selectedLanguage.monaco}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-dark"
              onMount={(editor, monaco) => {
                // Disable paste during contest
                editor.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
                  () => {
                    toast.error("Pasting is disabled during the contest");
                  }
                );
                editor.onContextMenu((e: any) => {
                  e.event.preventDefault();
                });
              }}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                contextmenu: false,
              }}
            />
          </div>

          {/* Vertical Resize Handle */}
          {!isIoMinimized && (
            <div
              onMouseDown={handleVerticalMouseDown}
              className="hidden lg:flex h-1.5 items-center justify-center cursor-row-resize group transition-colors flex-shrink-0"
              style={{ background: "var(--border)" }}
            >
              <GripHorizontal className="w-3 h-3 group-hover:opacity-100 opacity-40 transition-opacity" style={{ color: "var(--foreground-secondary)" }} />
            </div>
          )}

          {/* I/O Panel */}
          <div
            className="flex flex-col flex-shrink-0"
            style={{
              height: isIoMinimized ? "40px" : `${ioHeight}px`,
              borderTop: "1px solid var(--border)",
              background: "var(--background-card)",
            }}
          >
            <div
              className="flex items-center h-10 flex-shrink-0"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div
                className="w-1/2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium"
                style={{ color: "var(--foreground-secondary)" }}
              >
                Custom Input
              </div>
              <div
                className="w-1/2 px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium"
                style={{
                  color: "var(--foreground-secondary)",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                Output
              </div>
              <button
                onClick={() => setIsIoMinimized(!isIoMinimized)}
                className="px-3 py-2 transition-colors flex-shrink-0"
                style={{ color: "var(--foreground-secondary)" }}
                aria-label={isIoMinimized ? "Expand I/O" : "Minimize I/O"}
              >
                {isIoMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>
            </div>
            {!isIoMinimized && (
              <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter custom input (optional)..."
                  className="w-full sm:w-1/2 p-3 sm:p-4 font-mono text-xs sm:text-sm resize-none focus:outline-none"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground-secondary)",
                  }}
                />
                <div
                  className="w-full sm:w-1/2 p-3 sm:p-4 font-mono text-xs sm:text-sm overflow-auto"
                  style={{
                    borderLeft: "1px solid var(--border)",
                    background: "var(--background)",
                  }}
                >
                  {testResults ? (
                    <div className="space-y-2">
                      <div
                        className="font-semibold"
                        style={{
                          color:
                            testResults.verdict === "ACCEPTED"
                              ? "#22C55E"
                              : "#EF4444",
                        }}
                      >
                        {testResults.verdict.replace(/_/g, " ")}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        Tests: {testResults.testcasesPassed}/
                        {testResults.totalTestcases}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--foreground-secondary)" }}
                      >
                        Score: {testResults.score}/{problem.score}
                      </div>
                    </div>
                  ) : (
                    <pre
                      className="whitespace-pre-wrap"
                      style={{ color: "var(--foreground-secondary)" }}
                    >
                      {output || "Output will appear here..."}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
