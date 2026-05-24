"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/common/Loader";
import { formatDate } from "@/lib/formatTime";
import {
  Calendar,
  Clock,
  Users,
  Award,
  FileText,
  Code2,
  ClipboardList,
  CheckCircle,
  Play,
} from "lucide-react";
import toast from "react-hot-toast";

interface ContestDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function ContestDetailsPage({ params }: ContestDetailsPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();

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

  // Fetch contest details
  const fetchContestDetails = async () => {
    try {
      const res = await fetch(`/api/contests/${id}`);
      const data = await res.json();
      if (data.success) {
        setContest(data.contest);
      } else {
        toast.error("Contest not found");
      }
    } catch {
      toast.error("Failed to fetch contest details");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const res = await fetch(`/api/contests/${id}/progress`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setUserProgress(data.progress);
    } catch {
      setUserProgress(null);
    }
  };

  const fetchRegistrationStatus = async () => {
    try {
      const res = await fetch(`/api/contests/${id}/registration-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRegistrationStatus(data);
    } catch {
      setRegistrationStatus(null);
    }
  };

  useEffect(() => {
    fetchContestDetails();
    if (isAuthenticated && token) {
      fetchUserProgress();
      fetchRegistrationStatus();
    }
  }, [id, isAuthenticated, token]);

  // Countdown timer for UPCOMING contests
  useEffect(() => {
    if (!contest || contest.status !== "UPCOMING") {
      setCountdown(null);
      return;
    }

    const calculateCountdown = () => {
      const diff = new Date(contest.startTime).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        fetchContestDetails();
        return;
      }
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [contest]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      toast.error("Please login to register");
      router.push("/login");
      return;
    }
    try {
      setRegistering(true);
      const res = await fetch(`/api/contests/${id}/register`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Successfully registered for contest!");
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
      const res = await fetch(`/api/contests/${id}/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/contest/${id}/hub`);
      } else {
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
        <div className="card p-8 text-center">
          <p className="text-lg text-muted-ui">Contest not found</p>
        </div>
      </div>
    );
  }

  const isRegistered = registrationStatus?.isRegistered || false;
  const hasSubmitted = userProgress?.status === "SUBMITTED";
  const isLive = contest.status === "LIVE";
  const isEnded = contest.status === "ENDED";
  const totalMarks =
    (contest.sections?.mcq?.totalMarks || 0) +
    (contest.sections?.coding?.totalMarks || 0) +
    (contest.sections?.forms?.totalMarks || 0);

  return (
    <div className="page-shell">
      <div className="section-shell max-w-4xl">
        {/* Status Badge */}
        <div className="mb-6">
          {contest.status === "LIVE" && (
            <span className="badge-primary">🔴 LIVE NOW</span>
          )}
          {contest.status === "UPCOMING" && (
            <span className="badge-neutral">🕒 UPCOMING</span>
          )}
          {contest.status === "ENDED" && (
            <span className="badge-neutral">✓ ENDED</span>
          )}
        </div>

        {/* Main Card */}
        <div className="card p-6 sm:p-8 mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold mb-2 text-strong font-display">
            {contest.title}
          </h1>
          <p className="text-sm mb-4 text-soft-ui">
            Hosted by {contest.createdBy?.name || "Admin"}
          </p>
          <p className="text-base sm:text-lg mb-6 text-muted-ui">
            {contest.description}
          </p>

          {/* Time Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="surface-muted flex items-center gap-3 p-4">
              <Calendar className="w-6 h-6 text-primary-500" />
              <div>
                <div className="text-sm text-muted-ui">Start Time</div>
                <div className="font-semibold text-strong">
                  {formatDate(contest.startTime)}
                </div>
              </div>
            </div>
            <div className="surface-muted flex items-center gap-3 p-4">
              <Calendar className="w-6 h-6 text-primary-500" />
              <div>
                <div className="text-sm text-muted-ui">End Time</div>
                <div className="font-semibold text-strong">
                  {formatDate(contest.endTime)}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="surface-muted flex items-center gap-3 p-3 sm:p-4">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 text-primary-500" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm text-muted-ui">Duration</div>
                <div className="font-semibold text-sm sm:text-base text-strong">
                  {contest.duration} minutes
                </div>
              </div>
            </div>
            <div className="surface-muted flex items-center gap-3 p-3 sm:p-4">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 text-primary-500" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm text-muted-ui">Participants</div>
                <div className="font-semibold text-sm sm:text-base text-strong">
                  {contest.participants?.length || 0} registered
                </div>
              </div>
            </div>
            <div className="surface-muted flex items-center gap-3 p-3 sm:p-4">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 text-primary-500" />
              <div className="min-w-0">
                <div className="text-xs sm:text-sm text-muted-ui">Total Marks</div>
                <div className="font-semibold text-sm sm:text-base text-strong">
                  {totalMarks} points
                </div>
              </div>
            </div>
          </div>

          {/* Sections Preview */}
          <div className="flex flex-wrap gap-4 mb-6">
            {contest.sections?.mcq?.enabled && (
              <div className="card flex-1 min-w-[200px] p-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-primary-500" />
                  <h3 className="text-lg font-semibold text-strong">
                    MCQ Section
                  </h3>
                </div>
                <p className="text-sm text-muted-ui">
                  Marks: {contest.sections.mcq.totalMarks}
                </p>
              </div>
            )}
            {contest.sections?.coding?.enabled && (
              <div className="card flex-1 min-w-[200px] p-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-3 mb-2">
                  <Code2 className="w-6 h-6 text-primary-500" />
                  <h3 className="text-lg font-semibold text-strong">
                    Coding Section
                  </h3>
                </div>
                <p className="text-sm text-muted-ui">
                  Marks: {contest.sections.coding.totalMarks}
                </p>
              </div>
            )}
            {contest.sections?.forms?.enabled && (
              <div className="card flex-1 min-w-[200px] p-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardList className="w-6 h-6 text-primary-500" />
                  <h3 className="text-lg font-semibold text-strong">
                    Forms Section
                  </h3>
                </div>
                <p className="text-sm text-muted-ui">
                  Marks: {contest.sections.forms.totalMarks}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 flex-wrap">
            {/* Not registered yet */}
            {!isRegistered && !isEnded && (
              <button
                onClick={handleRegister}
                disabled={registering}
                className="flex-1 btn-primary py-3 text-lg"
              >
                {registering ? "Registering..." : "Register for Contest"}
              </button>
            )}

            {/* Registered but not submitted */}
            {isRegistered && !isEnded && !hasSubmitted && (
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary-500">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Registered</span>
                </div>

                {/* Countdown for UPCOMING */}
                {contest.status === "UPCOMING" && countdown && (
                  <div
                    className="rounded-xl p-4"
                    style={{
                      border: "1px solid rgb(var(--color-accent-500) / 0.3)",
                      backgroundColor:
                        "rgb(var(--color-accent-500) / 0.08)",
                    }}
                  >
                    <p className="text-sm mb-3 flex items-center gap-2 text-muted-ui">
                      <Clock className="w-4 h-4" /> Contest starts in:
                    </p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { value: countdown.days, label: "Days" },
                        { value: countdown.hours, label: "Hours" },
                        { value: countdown.minutes, label: "Minutes" },
                        { value: countdown.seconds, label: "Seconds" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="surface-muted rounded-lg p-2"
                        >
                          <div
                            className={`text-2xl font-bold text-primary-500 ${
                              item.label === "Seconds" ? "animate-pulse" : ""
                            }`}
                          >
                            {String(item.value).padStart(2, "0")}
                          </div>
                          <div className="text-xs text-soft-ui">
                            {item.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Start button for LIVE */}
                {isLive && (
                  <button
                    onClick={handleStartContest}
                    disabled={starting}
                    className="btn-primary py-3 text-lg flex items-center justify-center gap-2"
                  >
                    {starting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Start Contest
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Submitted */}
            {isRegistered && hasSubmitted && (
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary-500">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Contest Submitted</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/leaderboard/${id}`)}
                    className="flex-1 btn-primary py-3 text-lg"
                  >
                    View Leaderboard
                  </button>
                  <button
                    onClick={() => router.push(`/contest/${id}/review`)}
                    className="flex-1 btn-secondary py-3 text-lg"
                  >
                    Review Answers
                  </button>
                </div>
              </div>
            )}

            {/* Ended and not participated */}
            {isEnded && !hasSubmitted && (
              <button
                onClick={() => router.push(`/leaderboard/${id}`)}
                className="flex-1 btn-primary py-3 text-lg"
              >
                View Leaderboard
              </button>
            )}
          </div>
        </div>

        {/* Rules */}
        {contest.rules && contest.rules.length > 0 && (
          <div className="card p-6 sm:p-8">
            <h2 className="text-2xl font-bold mb-4 text-strong font-display">
              Contest Rules
            </h2>
            <ul className="space-y-2">
              {contest.rules.map((rule: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-3 text-muted-ui"
                >
                  <span className="font-bold text-primary-500">
                    {index + 1}.
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
