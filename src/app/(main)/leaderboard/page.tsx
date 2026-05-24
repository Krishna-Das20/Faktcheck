"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Loader from "@/components/common/Loader";
import toast from "react-hot-toast";
import { Trophy, ChevronRight, Calendar, Users } from "lucide-react";

export default function LeaderboardListPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await fetch("/api/contests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const now = new Date();
        const completed = (data.contests || []).filter((c: any) => {
          const endTime = new Date(c.endTime);
          return endTime <= now || c.status === "COMPLETED";
        });
        setContests(completed);
      } catch {
        toast.error("Failed to load contests");
      }
      setLoading(false);
    };
    fetchContests();
  }, [token]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="page-shell">
      <div className="section-shell max-w-4xl">
        <div className="page-header text-center">
          <h1 className="page-title font-display flex items-center justify-center gap-3">
            <Trophy className="w-10 h-10 text-primary-500" />
            Leaderboards
          </h1>
          <p className="page-subtitle">
            Select a contest to view its leaderboard
          </p>
        </div>

        <div className="space-y-4">
          {contests.length === 0 ? (
            <div className="card text-center py-12">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-ui" />
              <p className="text-muted-ui">No completed contests yet</p>
            </div>
          ) : (
            contests.map((contest) => (
              <button
                key={contest._id}
                onClick={() => router.push(`/leaderboard/${contest._id}`)}
                className="card-hover w-full p-5 text-left flex items-center justify-between group"
              >
                <div>
                  <h3 className="text-lg font-semibold text-strong transition-colors">
                    {contest.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-ui">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(contest.endTime).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {contest.participants?.length || 0} participants
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-soft-ui group-hover:text-primary-500 transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
