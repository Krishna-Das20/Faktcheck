"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Users, ArrowLeft, Download, Search } from "lucide-react";

export default function ContestParticipantsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const { token } = useAuth();
  const router = useRouter();
  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/contests/${contestId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setContest(data.contest);
      } catch { toast.error("Failed to load"); }
      setLoading(false);
    };
    fetch_();
  }, [contestId]);

  const participants = contest?.participants || [];
  const filtered = participants.filter((p: any) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const csv = ["Name,Email,College\n", ...filtered.map((p: any) => `"${p.name || ""}","${p.email || ""}","${p.college || ""}"\n`)].join("");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `participants_${contestId}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success("Exported!");
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="max-w-5xl mx-auto px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-4" style={{ color: "var(--foreground-secondary)" }}>
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8" style={{ color: "#A855F7" }} />
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Participants</h1>
              <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>{contest?.title} — {participants.length} registered</p>
            </div>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(34,197,94,0.2)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}>
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground-secondary)" }} />
          <input type="text" placeholder="Search participants..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--background-card)", border: "1px solid var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--background-secondary)" }}>
                {["#", "Name", "Email", "College", "Joined"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-sm font-semibold" style={{ color: "var(--foreground-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--foreground-secondary)" }}>No participants found</td></tr>
              ) : filtered.map((p: any, i: number) => (
                <tr key={p._id || i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{i + 1}</td>
                  <td className="py-3 px-4 font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</td>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{p.email}</td>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{p.college || "-"}</td>
                  <td className="py-3 px-4 text-sm" style={{ color: "var(--foreground-secondary)" }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
