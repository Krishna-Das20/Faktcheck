"use client";

import { ContestTimerProvider, useContestTimer } from "@/context/ContestTimerContext";
import { useAuth } from "@/context/AuthContext";
import ProctorGuard from "@/components/contest/ProctorGuard";
import { use, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import toast from "react-hot-toast";

interface ContestLayoutProps {
  children: ReactNode;
  params: Promise<{ contestId: string }>;
}

/**
 * Inner layout that has access to ContestTimerContext.
 * Wraps children with ProctorGuard based on the current section's proctoring settings.
 */
function ContestInner({
  contestId,
  children,
}: {
  contestId: string;
  children: ReactNode;
}) {
  const { token } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [proctorEnabled, setProctorEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  // Determine current section from pathname
  const sectionType = pathname.includes("/mcq")
    ? "mcq"
    : pathname.includes("/coding")
      ? "coding"
      : pathname.includes("/forms")
        ? "forms"
        : null;

  // Fetch contest proctoring settings
  useEffect(() => {
    let mounted = true;

    const checkProctoring = async () => {
      try {
        const res = await fetch(`/api/contests/${contestId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!mounted) return;

        const contest = data.contest;
        // Check if this specific section is proctored
        const isProctored =
          sectionType && contest?.sections?.[sectionType]?.proctored
            ? true
            : false;
        setProctorEnabled(isProctored);
      } catch {
        if (mounted) setProctorEnabled(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkProctoring();
    return () => {
      mounted = false;
    };
  }, [contestId, sectionType, token]);

  // Auto-submit ENTIRE contest on malpractice (3 violations)
  // The violation API already sets progress.status='SUBMITTED' and creates Result server-side.
  // Client handler saves current section answers and redirects to review.
  const handleAutoSubmit = useCallback(
    async (reason: string) => {
      try {
        // If user was in MCQ section, try to submit their answers
        if (sectionType === "mcq") {
          const mcqAnswers = JSON.parse(
            localStorage.getItem(`mcq_answers_${contestId}`) || "{}"
          );
          const formattedAnswers = Object.entries(mcqAnswers).map(
            ([mcqId, selectedOptions]) => ({
              mcqId,
              selectedOptions,
            })
          );
          // Best-effort save to section submit (server already has progress saved)
          try {
            await fetch(`/api/contests/${contestId}/sections/mcq/submit`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ mcqAnswers: formattedAnswers }),
            });
          } catch { /* Server-side violation handler already created the Result */ }
        }

        // Clear ALL localStorage for this contest
        Object.keys(localStorage).forEach((key) => {
          if (key.includes(contestId)) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        console.error("Auto-submit error");
      }

      // Navigate to review — entire contest is terminated
      setTimeout(() => {
        router.push(`/contest/${contestId}/review`);
      }, 2000);
    },
    [contestId, token, router, sectionType]
  );

  // If on hub page (not a section), don't enable proctoring
  if (!sectionType) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--background)" }}
      >
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto mb-4"
            style={{ borderTopColor: "var(--primary)" }}
          />
          <p style={{ color: "var(--foreground-secondary)" }}>
            Loading section...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProctorGuard
      contestId={contestId}
      onAutoSubmit={handleAutoSubmit}
      enabled={proctorEnabled}
    >
      {children}
    </ProctorGuard>
  );
}

export default function ContestLayout({
  children,
  params,
}: ContestLayoutProps) {
  const { contestId } = use(params);
  return (
    <ContestTimerProvider contestId={contestId}>
      <ContestInner contestId={contestId}>{children}</ContestInner>
    </ContestTimerProvider>
  );
}
