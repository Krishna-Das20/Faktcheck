"use client";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
  label?: string;
}

export default function Loader({
  size = "md",
  fullScreen = false,
  label = "Preparing experience...",
}: LoaderProps) {
  const sizeClasses: Record<string, string> = {
    sm: "h-8 w-8 border-[2px]",
    md: "h-10 w-10 border-[2.5px]",
    lg: "h-12 w-12 border-[3px]",
  };

  const shellClasses = fullScreen
    ? "page-shell flex min-h-screen items-center justify-center px-4"
    : "flex min-h-[12rem] items-center justify-center px-4 py-8";

  return (
    <div className={shellClasses}>
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full border-solid animate-spin`}
            style={{
              borderColor: "rgb(var(--color-border) / 0.34)",
              borderTopColor: "rgb(var(--color-accent-500))",
              borderRightColor: "rgb(var(--color-accent-500) / 0.72)",
            }}
          />
          <div
            className="absolute inset-[22%] rounded-full"
            style={{
              backgroundColor: "rgb(var(--color-accent-500) / 0.12)",
            }}
          />
        </div>

        {label && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-soft-ui">
              Loading
            </p>
            <p className="max-w-xs text-sm text-muted-ui">{label}</p>
          </div>
        )}
      </div>
    </div>
  );
}
