"use client";

import { useEffect } from "react";

export default function ContestError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("Contest error:", error); }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center px-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.1)" }}>
          <span className="text-2xl">📝</span>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>Contest Error</h2>
        <p className="text-sm mb-4" style={{ color: "var(--foreground-secondary)" }}>{error.message}</p>
        <button onClick={reset} className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: "#06B6D4" }}>Try Again</button>
      </div>
    </div>
  );
}
