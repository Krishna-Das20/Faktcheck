"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-4 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/10">
          <AlertTriangle className="h-7 w-7 text-primary-500" />
        </div>
        <h2 className="text-strong text-lg font-bold mb-2">
          Admin Error
        </h2>
        <p className="text-muted-ui text-sm mb-4">{error.message}</p>
        <button onClick={reset} className="btn-primary px-5 py-2.5 text-sm">
          Try Again
        </button>
      </div>
    </div>
  );
}
