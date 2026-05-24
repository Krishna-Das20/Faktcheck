"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/10">
          <AlertTriangle className="h-8 w-8 text-primary-500" />
        </div>
        <h2 className="text-strong text-xl font-bold mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-ui text-sm mb-6">
          {error.message || "An unexpected error occurred."}
        </p>
        <button onClick={reset} className="btn-primary px-6 py-3">
          Try Again
        </button>
      </div>
    </div>
  );
}
