"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VerifyContestsPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  // Admin-only guard — redirect organisers
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      toast.error("Admin access required");
      router.push("/");
    }
  }, [user]);

  const fetchPending = async () => {
    try {
      const res = await fetch("/api/admin/contests/pending", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setContests(data.contests || []);
    } catch { toast.error("Failed to load"); }
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleVerify = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const body: any = { status };
      if (status === "REJECTED") body.rejectionReason = rejectionReason[id] || "";
      const res = await fetch(`/api/admin/contests/${id}/verify`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { toast.success(data.message); fetchPending(); }
      else toast.error(data.message);
    } catch { toast.error("Failed to verify"); }
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center" >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="page-shell" >
      <div className="max-w-4xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4 transition-colors" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center gap-3 mb-8">
          <Clock className="w-8 h-8" style={{ color: "#EAB308" }} />
          <h1 className="text-3xl font-bold text-strong">Pending Approvals</h1>
        </div>

        {contests.length === 0 ? (
          <div className="rounded-xl text-center py-12" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
            <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#22C55E" }} />
            <p style={{ color: "var(--foreground-secondary)" }}>No contests pending approval</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((c) => (
              <div key={c._id} className="rounded-xl p-6" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-strong">{c.title}</h3>
                    <p className="text-sm mt-1" style={{ color: "var(--foreground-secondary)" }}>by {c.createdBy?.name} ({c.createdBy?.email})</p>
                    <p className="text-sm mt-2" style={{ color: "var(--foreground-secondary)" }}>{c.description}</p>
                    <p className="text-xs mt-2" style={{ color: "var(--foreground-secondary)" }}>
                      {new Date(c.startTime).toLocaleString()} → {new Date(c.endTime).toLocaleString()} | Duration: {c.duration}min
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text" placeholder="Rejection reason (optional)"
                    value={rejectionReason[c._id] || ""}
                    onChange={(e) => setRejectionReason({ ...rejectionReason, [c._id]: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                  />
                  <button onClick={() => handleVerify(c._id, "APPROVED")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#22C55E" }}>
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => handleVerify(c._id, "REJECTED")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#EF4444" }}>
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
