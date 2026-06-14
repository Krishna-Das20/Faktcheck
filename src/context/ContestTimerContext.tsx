"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatTime } from "@/lib/formatTime";
import toast from "react-hot-toast";

type SectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";

interface Progress {
  status: string;
  startedAt: string;
  terminationReason?: string;
  mcqProgress?: any;
  codingProgress?: any;
  formsProgress?: any;
}

interface ContestTimerContextType {
  isStarted: boolean;
  progress: Progress | null;
  contest: any;
  loading: boolean;
  startContest: () => Promise<any>;
  fetchProgress: () => Promise<void>;

  // Section statuses
  sectionStatuses: Record<string, SectionStatus>;

  // Section timer (active section only)
  activeSectionTimer: number | null;
  activeSectionFormatted: string;
  activeSection: string | null;

  // Section lifecycle
  startSection: (section: string) => Promise<any>;
  submitSection: (section: string, data?: any) => Promise<any>;
  setActiveSection: (section: string | null) => void;
}

const ContestTimerContext = createContext<ContestTimerContextType | undefined>(
  undefined
);

export function useContestTimer() {
  const context = useContext(ContestTimerContext);
  if (!context) {
    throw new Error(
      "useContestTimer must be used within ContestTimerProvider"
    );
  }
  return context;
}

export function ContestTimerProvider({
  children,
  contestId,
}: {
  children: ReactNode;
  contestId: string;
}) {
  const [isStarted, setIsStarted] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, SectionStatus>>({
    mcq: "NOT_STARTED",
    coding: "NOT_STARTED",
    forms: "NOT_STARTED",
  });

  // Active section timer
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeSectionTimer, setActiveSectionTimer] = useState<number | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  const activeTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const { token } = useAuth();

  // Fetch progress from server
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/start`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success && data.started) {
        setIsStarted(true);
        setProgress(data.progress);
        setContest(data.contest);
        setSectionStatuses(data.sectionStatuses || {
          mcq: "NOT_STARTED",
          coding: "NOT_STARTED",
          forms: "NOT_STARTED",
        });
      }
      setLoading(false);
    } catch {
      console.error("Failed to fetch progress");
      setLoading(false);
    }
  }, [contestId, token]);

  // Start contest
  const startContest = async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setIsStarted(true);
        setProgress(data.progress);
        setContest(data.contest);
        setSectionStatuses(data.sectionStatuses || {
          mcq: "NOT_STARTED",
          coding: "NOT_STARTED",
          forms: "NOT_STARTED",
        });
        return data;
      } else {
        toast.error(data.message || "Failed to start contest");
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start contest");
      throw error;
    }
  };

  // Start a section
  const startSection = async (section: string) => {
    try {
      const res = await fetch(`/api/contests/${contestId}/sections/${section}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        setSectionStatuses((prev) => ({ ...prev, [section]: "IN_PROGRESS" }));
        setActiveSection(section);
        hasAutoSubmittedRef.current = false;

        // Set timer if section has one
        if (data.hasTimer && data.remainingTime !== null) {
          setActiveSectionTimer(data.remainingTime);
        } else {
          setActiveSectionTimer(null);
        }
        return data;
      } else {
        toast.error(data.message || `Failed to start ${section} section`);
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to start ${section} section`);
      throw error;
    }
  };

  // Submit a section
  const submitSection = async (section: string, data?: any) => {
    try {
      const res = await fetch(`/api/contests/${contestId}/sections/${section}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data || {}),
      });
      const result = await res.json();

      if (result.success) {
        setSectionStatuses((prev) => ({ ...prev, [section]: "SUBMITTED" }));

        // Stop the active timer
        setActiveSection(null);
        setActiveSectionTimer(null);
        if (activeTimerIntervalRef.current) {
          clearInterval(activeTimerIntervalRef.current);
          activeTimerIntervalRef.current = null;
        }

        // Clear section-specific localStorage
        if (section === "mcq") {
          localStorage.removeItem(`mcq_answers_${contestId}`);
        }
        if (section === "forms") {
          localStorage.removeItem(`form_responses_${contestId}`);
        }

        if (result.allSectionsSubmitted) {
          toast.success("All sections submitted! Contest complete.");
          // Update overall status
          setProgress((prev) => prev ? { ...prev, status: "SUBMITTED" } : prev);
        } else {
          toast.success(`${section.toUpperCase()} section submitted!`);
        }

        return result;
      } else {
        toast.error(result.message || `Failed to submit ${section} section`);
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to submit ${section} section`);
      throw error;
    }
  };

  // Section timer countdown
  useEffect(() => {
    // Clear existing timer
    if (activeTimerIntervalRef.current) {
      clearInterval(activeTimerIntervalRef.current);
      activeTimerIntervalRef.current = null;
    }

    if (!activeSection || activeSectionTimer === null) return;

    activeTimerIntervalRef.current = setInterval(() => {
      setActiveSectionTimer((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          // Timer expired — auto-submit this section
          if (!hasAutoSubmittedRef.current) {
            hasAutoSubmittedRef.current = true;
            toast.error("Section time is up! Auto-submitting...");

            // Build submit data based on section
            if (activeSection === "mcq") {
              const mcqAnswers = JSON.parse(
                localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
              );
              const formattedAnswers = Object.entries(mcqAnswers).map(
                ([mcqId, selectedOptions]) => ({ mcqId, selectedOptions })
              );
              submitSection("mcq", { mcqAnswers: formattedAnswers }).then(() => {
                router.push(`/contest/${contestId}/hub`);
              }).catch(() => {
                router.push(`/contest/${contestId}/hub`);
              });
            } else if (activeSection === "coding") {
              submitSection("coding").then(() => {
                router.push(`/contest/${contestId}/hub`);
              }).catch(() => {
                router.push(`/contest/${contestId}/hub`);
              });
            } else if (activeSection === "forms") {
              submitSection("forms").then(() => {
                router.push(`/contest/${contestId}/hub`);
              }).catch(() => {
                router.push(`/contest/${contestId}/hub`);
              });
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (activeTimerIntervalRef.current) {
        clearInterval(activeTimerIntervalRef.current);
        activeTimerIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, contestId]);

  // Warn user when leaving during active section
  useEffect(() => {
    if (!activeSection) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message =
        "You have an active section! Leaving may result in auto-submission.";
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeSection]);

  // Fetch progress on mount
  useEffect(() => {
    if (contestId && token) {
      fetchProgress();
    }
  }, [contestId, token, fetchProgress]);

  const value: ContestTimerContextType = {
    isStarted,
    progress,
    contest,
    loading,
    startContest,
    fetchProgress,
    sectionStatuses,
    activeSectionTimer,
    activeSectionFormatted: formatTime(activeSectionTimer ?? 0),
    activeSection,
    startSection,
    submitSection,
    setActiveSection,
  };

  return (
    <ContestTimerContext.Provider value={value}>
      {children}
    </ContestTimerContext.Provider>
  );
}
