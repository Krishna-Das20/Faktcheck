"use client";

import { useState, useEffect } from "react";
import ContestCard from "@/components/contest/ContestCard";
import Loader from "@/components/common/Loader";
import { Filter } from "lucide-react";
import toast from "react-hot-toast";

const filterButtons = [
  { label: "All", value: "ALL" },
  { label: "Live", value: "LIVE" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Ended", value: "ENDED" },
];

export default function ContestListPage() {
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchContests();
  }, [filter]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      const statusParam = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/contests${statusParam}`);
      const data = await res.json();

      if (data.success) {
        setContests(data.contests);
      } else {
        toast.error(data.message || "Failed to fetch contests");
      }
    } catch {
      toast.error("Failed to fetch contests");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="page-shell">
      <div className="section-shell">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title font-display">All Contests</h1>
          <p className="page-subtitle">
            Browse and participate in exciting coding contests
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-muted-ui">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filter:</span>
          </div>
          <div className="flex gap-3">
            {filterButtons.map((btn) => (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value)}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
                  filter === btn.value
                    ? "btn-primary"
                    : "btn-secondary"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contest Grid */}
        {contests.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted-ui text-lg">No contests found</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contests.map((contest) => (
              <ContestCard key={contest._id} contest={contest} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
