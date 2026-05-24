export default function ContestLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full animate-spin border-3 border-transparent" style={{ borderTopColor: "#06B6D4" }} />
        <p className="text-sm" style={{ color: "var(--foreground-secondary)" }}>Loading contest...</p>
      </div>
    </div>
  );
}
