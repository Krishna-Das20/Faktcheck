"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { Award, Download, Share2 } from "lucide-react";

export default function CertificatePage() {
  const { resultId } = useParams<{ resultId: string }>();
  const { token } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    const fetchCertificate = async () => {
      try {
        // Step 1: Fetch result by resultId to get contestId
        const resultRes = await fetch(`/api/results/${resultId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const resultData = await resultRes.json();

        if (!resultRes.ok || !resultData.result) {
          toast.error("Result not found");
          setLoading(false);
          return;
        }

        const contestId =
          resultData.result.contestId?._id || resultData.result.contestId;

        // Step 2: Generate certificate via POST
        const certRes = await fetch(
          `/api/leaderboard/${contestId}/certificate`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const certData = await certRes.json();

        // Merge result data with certificate data for rendering
        setResult({
          ...resultData.result,
          ...(certData.certificate || {}),
        });
      } catch {
        toast.error("Failed to load certificate");
      }
      setLoading(false);
    };
    fetchCertificate();
  }, [resultId, token]);

  const handleDownload = async () => {
    if (!certRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: null });
      const link = document.createElement("a");
      link.download = `certificate-${result?.contestId?.title || "contest"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Certificate downloaded!");
    } catch {
      toast.error("Failed to download. Try again.");
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "My Contest Certificate",
        text: `I achieved Rank #${result?.rank} in ${result?.contestId?.title || "the contest"}!`,
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderTopColor: "var(--primary)" }} /></div>;

  if (!result) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)", color: "var(--foreground)" }}>Certificate not found</div>;

  return (
    <div className="min-h-screen py-8" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8" style={{ color: "#EAB308" }} />
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>Certificate</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm" style={{ background: "var(--background-secondary)", color: "var(--foreground)" }}>
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold" style={{ background: "var(--primary)" }}>
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
        </div>

        {/* Certificate */}
        <div ref={certRef} className="relative overflow-hidden rounded-2xl mx-auto" style={{ maxWidth: 800, aspectRatio: "1.414/1" }}>
          {/* Background */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} />

          {/* Border decoration */}
          <div className="absolute inset-3 rounded-xl" style={{ border: "2px solid rgba(234,179,8,0.4)" }} />
          <div className="absolute inset-5 rounded-xl" style={{ border: "1px solid rgba(234,179,8,0.2)" }} />

          {/* Corner decorations */}
          {[{ top: 20, left: 20 }, { top: 20, right: 20 }, { bottom: 20, left: 20 }, { bottom: 20, right: 20 }].map((pos, i) => (
            <div key={i} className="absolute w-8 h-8" style={{ ...pos }}>
              <Award className="w-full h-full" style={{ color: "rgba(234,179,8,0.3)" }} />
            </div>
          ))}

          {/* Content */}
          <div className="relative flex flex-col items-center justify-center h-full px-12 py-10 text-center">
            {/* Logo */}
            <div className="mb-2">
              <span className="text-2xl font-bold tracking-wider" style={{ color: "#EAB308", fontFamily: "serif" }}>
                FaktCheck
              </span>
            </div>

            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
              Certificate of Achievement
            </p>

            <div className="w-24 h-0.5 mb-6" style={{ background: "linear-gradient(90deg, transparent, #EAB308, transparent)" }} />

            <p className="text-base mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>This certifies that</p>

            <h2 className="text-3xl font-bold mb-4" style={{ color: "#FFFFFF", fontFamily: "serif" }}>
              {result?.userId?.name || result?.name || "Participant"}
            </h2>

            <p className="text-base mb-2" style={{ color: "rgba(255,255,255,0.7)" }}>has participated and achieved</p>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl font-bold" style={{ color: "#EAB308" }}>
                Rank #{result?.rank || "N/A"}
              </span>
            </div>

            <p className="text-base mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>in the contest</p>

            <h3 className="text-xl font-bold mb-2" style={{ color: "var(--primary, #FF6B35)" }}>
              {result?.contestId?.title || result?.contestTitle || "Contest"}
            </h3>

            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              Score: {result?.totalScore || 0} / {(result?.mcqScore || 0) + (result?.codingScore || 0) + (result?.formScore || 0) || result?.totalScore || 0}
            </p>

            <div className="w-24 h-0.5 mb-4" style={{ background: "linear-gradient(90deg, transparent, #EAB308, transparent)" }} />

            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              Issued on {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
