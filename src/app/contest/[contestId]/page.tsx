"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/common/Loader";
import {
  Calendar,
  Clock,
  Users,
  Award,
  FileText,
  Code2,
  CheckCircle,
  Play,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

const statusClassMap: Record<string, string> = {
  LIVE: "badge-primary",
  UPCOMING: "badge-neutral",
  ENDED: "badge-neutral",
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ContestDetailsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const router = useRouter();
  const { token, user } = useAuth();
  const isAuthenticated = !!token && !!user;

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [starting, setStarting] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [registrationStatus, setRegistrationStatus] = useState<any>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Countdown timer for upcoming contests
  useEffect(() => {
    if (!contest || contest.status !== "UPCOMING") {
      setCountdown(null);
      return;
    }

    const calculateCountdown = () => {
      const now = new Date().getTime();
      const startTime = new Date(contest.startTime).getTime();
      const diff = startTime - now;

      if (diff <= 0) {
        setCountdown(null);
        fetchContestDetails();
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ days, hours, minutes, seconds });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [contest]);

  useEffect(() => {
    fetchContestDetails();
    if (isAuthenticated) {
      fetchUserProgress();
      fetchRegistrationStatus();
    }
  }, [contestId, isAuthenticated]);

  const fetchContestDetails = async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setContest(data.contest);
    } catch {
      toast.error("Failed to fetch contest details");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const res = await fetch(`/api/contests/${contestId}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUserProgress(data.progress);
    } catch {
      setUserProgress(null);
    }
  };

  const fetchRegistrationStatus = async () => {
    try {
      const res = await fetch(
        `/api/contests/${contestId}/registration-status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setRegistrationStatus(data);
    } catch {
      setRegistrationStatus(null);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to register");
      router.push("/login");
      return;
    }

    try {
      setRegistering(true);
      const res = await fetch(`/api/contests/${contestId}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Successfully registered for contest");
        await fetchRegistrationStatus();
        await fetchContestDetails();
      } else {
        toast.error(data.message || "Registration failed");
      }
    } catch {
      toast.error("Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleStartContest = async () => {
    try {
      setStarting(true);
      const res = await fetch(`/api/contests/${contestId}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        router.push(`/contest/${contestId}/hub`);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to start contest");
        setStarting(false);
      }
    } catch {
      toast.error("Failed to start contest");
      setStarting(false);
    }
  };

  if (loading) return <Loader fullScreen />;

  if (!contest) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="card text-center text-muted-ui">
          Contest not found.
        </div>
      </div>
    );
  }

  const isRegistered = registrationStatus?.isRegistered || false;
  const isLive = contest.status === "LIVE";
  const isEnded = contest.status === "ENDED";

  const infoItems = [
    {
      icon: Calendar,
      label: "Start time",
      value: formatDate(contest.startTime),
    },
    { icon: Calendar, label: "End time", value: formatDate(contest.endTime) },
    { icon: Clock, label: "Duration", value: `${contest.duration} minutes` },
    {
      icon: Users,
      label: "Participants",
      value: `${contest.participants?.length || 0} registered`,
    },
    {
      icon: Award,
      label: "Total marks",
      value: `${
        (contest.sections?.mcq?.totalMarks || 0) +
        (contest.sections?.coding?.totalMarks || 0) +
        (contest.sections?.forms?.totalMarks || 0)
      } points`,
    },
  ];

  return (
    <div className="page-shell">
      <div className="section-shell max-w-5xl space-y-6">
        {/* Status + Host */}
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={statusClassMap[contest.status] || "badge-neutral"}
          >
            {contest.status}
          </span>
          <span className="text-sm text-soft-ui">
            Hosted by {contest.createdBy?.name || "Admin"}
          </span>
        </div>

        {/* Main Card */}
        <section className="card space-y-6">
          {/* Title + Description */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-strong sm:text-4xl">
              {contest.title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-ui sm:text-base">
              {contest.description}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {infoItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="surface-muted p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <Icon
                    className="h-5 w-5"
                    style={{ color: "rgb(var(--color-accent-500))" }}
                  />
                </div>
                <div className="text-xs uppercase tracking-[0.12em] text-soft-ui">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-strong">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Section Cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {contest.sections?.mcq?.enabled && (
              <div className="surface-muted p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <FileText
                    className="h-5 w-5"
                    style={{ color: "rgb(var(--color-accent-500))" }}
                  />
                </div>
                <div className="font-semibold text-strong">MCQ section</div>
                <div className="mt-1 text-sm text-muted-ui">
                  {contest.sections.mcq.totalMarks} marks
                </div>
              </div>
            )}
            {contest.sections?.coding?.enabled && (
              <div className="surface-muted p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <Code2
                    className="h-5 w-5"
                    style={{ color: "rgb(var(--color-accent-500))" }}
                  />
                </div>
                <div className="font-semibold text-strong">Coding section</div>
                <div className="mt-1 text-sm text-muted-ui">
                  {contest.sections.coding.totalMarks} marks
                </div>
              </div>
            )}
            {contest.sections?.forms?.enabled && (
              <div className="surface-muted p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <ClipboardList
                    className="h-5 w-5"
                    style={{ color: "rgb(var(--color-accent-500))" }}
                  />
                </div>
                <div className="font-semibold text-strong">Forms section</div>
                <div className="mt-1 text-sm text-muted-ui">
                  {contest.sections.forms.totalMarks} marks
                </div>
              </div>
            )}
          </div>

          {/* Action Area */}
          <div className="space-y-4">
            {/* Not registered + not ended → Register button */}
            {!isRegistered && !isEnded && (
              <button
                onClick={handleRegister}
                disabled={registering}
                className="btn-primary w-full sm:w-auto"
              >
                {registering ? "Registering..." : "Register for contest"}
              </button>
            )}

            {/* Registered + not ended + not submitted */}
            {isRegistered &&
              !isEnded &&
              userProgress?.status !== "SUBMITTED" && (
                <div className="space-y-4">
                  <div
                    className="inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: "rgb(var(--color-accent-500))" }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Registered
                  </div>

                  {/* Countdown for upcoming */}
                  {contest.status === "UPCOMING" && countdown && (
                    <div className="surface-muted p-4">
                      <p className="mb-3 text-sm text-muted-ui">
                        Contest starts in
                      </p>
                      <div className="grid grid-cols-4 gap-3">
                        {(
                          [
                            ["Days", countdown.days],
                            [
                              "Hours",
                              String(countdown.hours).padStart(2, "0"),
                            ],
                            [
                              "Minutes",
                              String(countdown.minutes).padStart(2, "0"),
                            ],
                            [
                              "Seconds",
                              String(countdown.seconds).padStart(2, "0"),
                            ],
                          ] as [string, string | number][]
                        ).map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border p-3 text-center"
                            style={{
                              borderColor: "rgb(var(--color-border))",
                              background: "rgb(var(--color-panel))",
                            }}
                          >
                            <div
                              className="text-xl font-bold"
                              style={{
                                color: "rgb(var(--color-accent-500))",
                              }}
                            >
                              {value}
                            </div>
                            <div className="mt-1 text-xs uppercase tracking-[0.12em] text-soft-ui">
                              {label}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Start button for live */}
                  {isLive && (
                    <button
                      onClick={handleStartContest}
                      disabled={starting}
                      className="btn-primary"
                    >
                      <Play className="h-4 w-4" />
                      {starting ? "Starting..." : "Start contest"}
                    </button>
                  )}
                </div>
              )}

            {/* Already submitted */}
            {isRegistered && userProgress?.status === "SUBMITTED" && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/leaderboard/${contestId}`}
                  className="btn-primary"
                >
                  View leaderboard
                </Link>
                <Link
                  href={`/contest/${contestId}/review`}
                  className="btn-secondary"
                >
                  Review answers
                </Link>
              </div>
            )}

            {/* Ended + not registered */}
            {isEnded && !userProgress?.status && (
              <Link
                href={`/leaderboard/${contestId}`}
                className="btn-primary"
              >
                View leaderboard
              </Link>
            )}
          </div>
        </section>

        {/* Rules Section */}
        {contest.rules && contest.rules.length > 0 && (
          <section className="card">
            <h2 className="mb-4 text-xl font-semibold text-strong">
              Contest rules
            </h2>
            <ul className="space-y-3 text-sm text-muted-ui">
              {contest.rules.map((rule: string, index: number) => (
                <li key={index} className="flex gap-3">
                  <span style={{ color: "rgb(var(--color-accent-500))" }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
