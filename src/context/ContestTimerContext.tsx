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

interface Progress {
  status: string;
  startedAt: string;
  terminationReason?: string;
  mcqProgress?: any;
  codingProgress?: any;
}

interface ContestTimerContextType {
  remainingTime: number | null;
  formattedTime: string;
  isStarted: boolean;
  progress: Progress | null;
  contest: any;
  loading: boolean;
  startContest: () => Promise<any>;
  finalSubmit: (mcqAnswers?: any[]) => Promise<any>;
  fetchProgress: () => Promise<void>;
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
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { token } = useAuth();

  const hasAutoSubmittedRef = useRef(false);

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
        setRemainingTime(data.remainingTime);
        setContest(data.contest);

        localStorage.setItem(
          `contest_${contestId}_startedAt`,
          data.progress.startedAt
        );
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
        setRemainingTime(data.remainingTime);

        localStorage.setItem(
          `contest_${contestId}_startedAt`,
          data.progress.startedAt
        );

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

  // Final submit
  const finalSubmit = async (mcqAnswers: any[] = []) => {
    try {
      const res = await fetch(`/api/contests/${contestId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mcqAnswers }),
      });
      const data = await res.json();

      if (data.success) {
        // Clear localStorage
        localStorage.removeItem(`contest_${contestId}_startedAt`);
        localStorage.removeItem(`timer_${contestId}`);
        localStorage.removeItem(`mcq_answers_${contestId}`);

        toast.success("Contest submitted successfully!");
        router.push(`/contests/${contestId}`);
        return data;
      } else {
        toast.error(data.message || "Failed to submit contest");
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit contest");
      throw error;
    }
  };

  // Timer countdown
  useEffect(() => {
    if (!isStarted || remainingTime === null) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (!hasAutoSubmittedRef.current) {
            hasAutoSubmittedRef.current = true;
            toast.error("Time is up! Auto-submitting...");

            // Read MCQ answers from localStorage
            const mcqAnswers = JSON.parse(
              localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
            );
            const formattedAnswers = Object.entries(mcqAnswers).map(
              ([mcqId, selectedOptions]) => ({ mcqId, selectedOptions })
            );
            finalSubmit(formattedAnswers);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted, contestId]);

  // Warn user when leaving during active contest
  useEffect(() => {
    if (!isStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const message =
        "You have an active contest! Leaving may result in auto-submission.";
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isStarted]);

  // Fetch progress on mount
  useEffect(() => {
    if (contestId && token) {
      fetchProgress();
    }
  }, [contestId, token, fetchProgress]);

  const value: ContestTimerContextType = {
    remainingTime,
    formattedTime: formatTime(remainingTime ?? 0),
    isStarted,
    progress,
    contest,
    loading,
    startContest,
    finalSubmit,
    fetchProgress,
  };

  return (
    <ContestTimerContext.Provider value={value}>
      {children}
    </ContestTimerContext.Provider>
  );
}
